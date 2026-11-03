// Our own narrow types. The tools return these, never the raw API objects,
// so the model gets fewer tokens and the API can change without breaking the tools.

export type TransportMode = "METRO" | "BUS" | "TRAIN" | "TRAM" | "SHIP" | "FERRY";

// Modes and preferences plan_trip can ask SL for, named like the modes in its output.
export const TRIP_MODES = ["commuter train", "metro", "tram", "bus", "boat", "train"] as const;
export type TripMode = (typeof TRIP_MODES)[number];
export const TRIP_PREFERENCES = ["fastest", "fewest changes", "least walking"] as const;
export type TripPreference = (typeof TRIP_PREFERENCES)[number];

export interface Stop {
  id: number; // site id, used by get_departures and plan_trip
  name: string; // "Stockholm, Slussen"
  modes: string[]; // "metro", "bus", ...
}

/** An address, stop or landmark that plan_trip can start or end at. */
export interface Place {
  id: string; // SL's own id, e.g. "streetID:..."
  name: string; // "Stockholm, Götgatan 76"
}

export interface Departure {
  line: string;
  transportMode: TransportMode;
  destination: string;
  direction: number; // 1 or 2
  display: string; // "Nu", "3 min" or "19:50"
  scheduled: string; // local time, no offset
  expected: string; // local time, no offset
  cancelled: boolean;
  platform?: string; // track, platform or bus stop letter, e.g. "G" at Slussen
  deviations: string[];
}

export interface Disruption {
  header: string;
  details: string;
  lines: string[];
  until?: string;
}

export interface TripLeg {
  mode: string; // "metro", "commuter train", "bus", "walk"
  line?: string;
  towards?: string;
  platform?: string; // where it leaves from: track for trains, platform for metro, stop letter for buses
  stops?: number; // stations to ride, not counting where you get on
  crowding?: string; // when you get on: "many seats", "few seats" or "standing only"
  lateMinutes?: number; // how late it leaves compared with the timetable
  exit?: string; // walks only: the station entrance used, in or out ("uppgång"), e.g. "Folkungagatan Götgatan"
  from: string;
  to: string;
  departure: string; // HH:MM Stockholm time
  arrival: string; // HH:MM Stockholm time
}

export interface Trip {
  departure: string;
  arrival: string;
  minutes: number;
  changes: number;
  legs: TripLeg[];
}
