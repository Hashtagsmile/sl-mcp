import { TtlCache } from "../lib/cache.js";
import type { Departure, Disruption, Place, Stop, TransportMode, Trip, TripLeg } from "./types.js";

// SL's open APIs (no key needed). Notes from testing them: docs/sl-api.md (local, not in git).
//   GET {JOURNEY_PLANNER_API}/stop-finder   stop search, done by SL
//   GET {JOURNEY_PLANNER_API}/trips         trip planning from A to B
//   GET {TRANSPORT_API}/sites/{id}/departures
//   GET {DEVIATIONS_API}/messages           announced disruptions
// Example responses: test/fixtures/
export const JOURNEY_PLANNER_API = "https://journeyplanner.integration.sl.se/v2";
export const TRANSPORT_API = "https://transport.integration.sl.se/v1";
export const DEVIATIONS_API = "https://deviations.integration.sl.se/v1";

// stop-finder ids for sites look like 9091001 + 3-digit name variant + 6-digit site id.
// Other ids (9021...) are stop areas without departures, so we skip them.
const SITE_GID = /^9091001\d{9}$/;

// SL treats calc_number_of_trips as a minimum and often sends more, so we also cut the list.
const MAX_TRIPS = 3;

const PRODUCT_CLASSES: Record<number, string> = {
  0: "commuter train",
  2: "metro",
  4: "tram",
  5: "bus",
  9: "boat",
  14: "train",
};

// Trip search errors SL explains with a code, from testing them.
const TRIP_ERRORS: Record<number, string> = {
  [-8020]: "SL does not know one of the stop ids. Get them from find_stop.",
  [-4007]: "Start and destination are the same stop, or too close to plan a trip between.",
  [-4001]: "SL cannot plan trips at that time. It is outside the current timetable, e.g. in the past.",
};

/** A trip search SL refused for a reason the user can fix. */
export class TripSearchError extends Error {}

export interface SlClientOptions {
  /** Swap in a fake fetch in tests. */
  fetch?: typeof fetch;
  timeoutMs?: number;
  /** Waits before each retry when SL answers 429 (too many requests). */
  retryDelaysMs?: number[];
}

export class SlClient {
  private readonly fetch: typeof fetch;
  private readonly timeoutMs: number;
  private readonly retryDelaysMs: number[];
  // SL asks for at most one disruptions request a minute.
  private readonly disruptions = new TtlCache<RawMessage[]>(60_000);

  constructor(options: SlClientOptions = {}) {
    this.fetch = options.fetch ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.retryDelaysMs = options.retryDelaysMs ?? [300, 1000];
  }

  /** Stops whose name matches the query, in SL's order. SL handles case and typos. */
  async findStop(query: string, limit = 5): Promise<Stop[]> {
    const params = new URLSearchParams({ name_sf: query, type_sf: "any", any_obj_filter_sf: "2" });
    const data = await this.getJson<{ locations?: RawLocation[] }>(`${JOURNEY_PLANNER_API}/stop-finder?${params}`);
    const stops: Stop[] = [];
    for (const location of data.locations ?? []) {
      if (!SITE_GID.test(location.id)) continue;
      // No transport modes means no departures, e.g. "Sundbyberg, Götgatan".
      if (!location.productClasses?.length) continue;
      const id = Number(location.id.slice(-6));
      if (stops.some((stop) => stop.id === id)) continue;
      const modes = location.productClasses.map((c) => PRODUCT_CLASSES[c]).filter((m) => m !== undefined);
      stops.push({ id, name: location.name, modes });
    }
    return stops.slice(0, limit);
  }

  async getDepartures(
    siteId: number,
    filter: { transportMode?: TransportMode; forecastMinutes?: number } = {},
  ): Promise<Departure[]> {
    const params = new URLSearchParams();
    if (filter.transportMode) params.set("transport", filter.transportMode);
    if (filter.forecastMinutes) params.set("forecast", String(filter.forecastMinutes));
    const data = await this.getJson<{ departures: RawDeparture[] }>(
      `${TRANSPORT_API}/sites/${siteId}/departures?${params}`,
    );
    return data.departures.map((d) => ({
      line: d.line.designation,
      transportMode: d.line.transport_mode,
      destination: d.destination,
      direction: d.direction_code,
      display: d.display,
      scheduled: d.scheduled,
      expected: d.expected ?? d.scheduled,
      cancelled: d.state === "CANCELLED",
      platform: d.stop_point?.designation,
      deviations: (d.deviations ?? []).map((deviation) => deviation.message),
    }));
  }

  /** Current disruptions, optionally only for some line numbers or one transport mode. */
  async getDisruptions(filter: { lines?: string[]; transportMode?: TransportMode } = {}): Promise<Disruption[]> {
    let messages = this.disruptions.get("all");
    if (!messages) {
      messages = await this.getJson<RawMessage[]>(`${DEVIATIONS_API}/messages`);
      this.disruptions.set("all", messages);
    }
    return messages
      .filter((m) => {
        const lines = m.scope?.lines ?? [];
        if (filter.lines?.length && !lines.some((l) => filter.lines!.includes(l.designation))) return false;
        if (filter.transportMode && !lines.some((l) => l.transport_mode === filter.transportMode)) return false;
        return true;
      })
      .map((m) => {
        const variant = m.message_variants[0];
        return {
          header: variant?.header ?? "",
          details: variant?.details.trim() ?? "",
          lines: (m.scope?.lines ?? []).map((l) => l.designation),
          until: m.publish?.upto,
        };
      });
  }

  /** The best match for an address or place, e.g. "Götgatan 76, Stockholm". */
  async findPlace(query: string): Promise<Place | undefined> {
    // Filter 0 also finds addresses, which findStop leaves out.
    const params = new URLSearchParams({ name_sf: query, type_sf: "any", any_obj_filter_sf: "0" });
    const data = await this.getJson<{ locations?: RawLocation[] }>(`${JOURNEY_PLANNER_API}/stop-finder?${params}`);
    const best = data.locations?.[0];
    return best && { id: best.id, name: best.name };
  }

  /**
   * Up to 3 trips between two places: a site id, or a place id from findPlace.
   * `time` is Stockholm time "YYYY-MM-DDTHH:MM"; without it, trips leave from now.
   */
  async planTrip(
    from: number | string,
    to: number | string,
    options: { time?: string; arriveBy?: boolean } = {},
  ): Promise<Trip[]> {
    const params = new URLSearchParams({
      type_origin: "any",
      name_origin: typeof from === "number" ? siteGid(from) : from,
      type_destination: "any",
      name_destination: typeof to === "number" ? siteGid(to) : to,
      calc_number_of_trips: String(MAX_TRIPS),
      calc_one_direction: "true", // otherwise the first trip has often already left
      gen_c: "false", // skip coordinates: 156 KB -> 61 KB
    });
    if (options.time) {
      params.set("itd_date", options.time.slice(0, 10).replaceAll("-", ""));
      params.set("itd_time", options.time.slice(11, 16).replace(":", ""));
      params.set("itd_trip_date_time_dep_arr", options.arriveBy ? "arr" : "dep");
    }
    const data = await this.getJson<{ journeys?: RawJourney[]; systemMessages?: { code: number }[] }>(
      `${JOURNEY_PLANNER_API}/trips?${params}`,
    );
    const known = data.systemMessages?.find((m) => TRIP_ERRORS[m.code]);
    if (!data.journeys?.length && known) throw new TripSearchError(TRIP_ERRORS[known.code]);
    let journeys = (data.journeys ?? []).slice(0, MAX_TRIPS);
    // For arrive-by, SL also suggests trips that arrive too late, and the best ones come last.
    if (options.time && options.arriveBy) {
      const latest = options.time.replace("T", " ");
      journeys = (data.journeys ?? [])
        .filter((journey) => stockholmDateTime.format(arrivalOf(journey)) <= latest)
        .slice(-MAX_TRIPS);
    }
    return journeys.map((journey) => {
      const legs: TripLeg[] = [];
      for (const leg of journey.legs.map(toTripLeg)) {
        const previous = legs.at(-1);
        // SL splits a walk at a station exit, e.g. "Medborgarplatsen -> Medborgarplatsen -> Götgatan 76".
        if (previous?.mode === "walk" && leg.mode === "walk") {
          Object.assign(previous, { to: leg.to, arrival: leg.arrival, exit: previous.exit ?? leg.exit });
        } else legs.push(leg);
      }
      return {
        departure: legs[0]?.departure ?? "",
        arrival: legs.at(-1)?.arrival ?? "",
        minutes: Math.max(1, Math.round((journey.tripRtDuration ?? journey.tripDuration) / 60)),
        changes: journey.interchanges,
        legs,
      };
    });
  }

  /** GET a URL and parse JSON, with a timeout, retries on 429 and a clear error on non-2xx. */
  private async getJson<T>(url: string): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const response = await this.fetch(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (response.status === 429 && attempt < this.retryDelaysMs.length) {
        await new Promise((resolve) => setTimeout(resolve, this.retryDelaysMs[attempt]));
        continue;
      }
      if (!response.ok) {
        throw new Error(`SL API answered ${response.status} ${response.statusText} for ${url}`);
      }
      return (await response.json()) as T;
    }
  }
}

function siteGid(siteId: number): string {
  return `9091001${String(siteId).padStart(9, "0")}`;
}

const stockholmTime = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Stockholm",
  hour: "2-digit",
  minute: "2-digit",
});

// "2026-11-04 08:30", compares as a string with the "YYYY-MM-DDTHH:MM" input
const stockholmDateTime = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Stockholm",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function arrivalOf(journey: RawJourney): Date {
  const last = journey.legs.at(-1)!.destination;
  return new Date(last.arrivalTimeEstimated ?? last.arrivalTimePlanned);
}

function toTripLeg(leg: RawLeg): TripLeg {
  const t = leg.transportation;
  const walk = t?.product?.name === "footpath";
  return {
    mode: walk ? "walk" : (PRODUCT_CLASSES[t?.product?.class ?? -1] ?? t?.product?.name ?? "unknown"),
    line: walk ? undefined : t?.disassembledName,
    towards: walk ? undefined : t?.destination?.name,
    from: shortName(leg.origin.name),
    to: shortName(leg.destination.name),
    platform: walk ? undefined : leg.origin.properties?.platformName,
    exit: walk ? exitOf(leg) : undefined,
    crowding: leg.origin.properties?.occupancy?.toLowerCase().replaceAll("_", " "),
    lateMinutes: lateMinutes(leg.origin.departureTimePlanned, leg.origin.departureTimeEstimated),
    // stopSequence lists every stop, including where you get on and off.
    stops: !walk && leg.stopSequence?.length ? leg.stopSequence.length - 1 : undefined,
    departure: stockholmTime.format(new Date(leg.origin.departureTimeEstimated ?? leg.origin.departureTimePlanned)),
    arrival: stockholmTime.format(new Date(leg.destination.arrivalTimeEstimated ?? leg.destination.arrivalTimePlanned)),
  };
}

// In SL's walk details, area type 32 is a station entrance, e.g. "Folkungagatan Götgatan" at Medborgarplatsen.
const ENTRANCE_AREA = 32;

/** Whole minutes late, or undefined when on time or without real time. */
function lateMinutes(planned: string, estimated?: string): number | undefined {
  const late = estimated ? Math.round((Date.parse(estimated) - Date.parse(planned)) / 60_000) : 0;
  return late > 0 ? late : undefined;
}

/** The station entrance a walk goes through, in or out. */
function exitOf(leg: RawLeg): string | undefined {
  const areas = (leg.footPathInfo ?? []).flatMap((f) => f.footPathElem ?? []).flatMap((e) => [e.origin, e.destination]);
  return areas.find((area) => area?.properties?.areaType === ENTRANCE_AREA)?.properties?.areaName;
}

/** "Stockholm Odenplan, Stockholm" -> "Stockholm Odenplan". "Odenplan, Stockholm" stays. */
function shortName(name: string): string {
  const [place, town] = name.split(", ");
  return town && place!.includes(town) ? place! : name;
}

// The parts of SL's responses we read.

interface RawLocation {
  id: string;
  name: string;
  productClasses?: number[];
}

interface RawDeparture {
  destination: string;
  direction_code: number;
  state: string;
  display: string;
  scheduled: string;
  expected?: string;
  line: { designation: string; transport_mode: TransportMode };
  stop_point?: { designation?: string };
  deviations?: { message: string }[];
}

interface RawMessage {
  message_variants: { header: string; details: string }[];
  scope?: { lines?: { designation: string; transport_mode: TransportMode }[] };
  publish?: { upto?: string };
}

interface RawJourney {
  tripDuration: number;
  tripRtDuration?: number;
  interchanges: number;
  legs: RawLeg[];
}

interface RawLeg {
  origin: {
    name: string;
    departureTimePlanned: string;
    departureTimeEstimated?: string;
    properties?: { platformName?: string; occupancy?: string }; // occupancy: MANY_SEATS, FEW_SEATS, STANDING_ONLY
  };
  destination: { name: string; arrivalTimePlanned: string; arrivalTimeEstimated?: string };
  transportation?: { disassembledName?: string; product?: { class?: number; name: string }; destination?: { name: string } };
  footPathInfo?: { footPathElem?: { origin?: RawArea; destination?: RawArea }[] }[];
  stopSequence?: unknown[];
}

interface RawArea {
  properties?: { areaName?: string; areaType?: number };
}
