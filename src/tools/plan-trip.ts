import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { type SlClient, TripSearchError } from "../sl/client.js";
import type { Trip } from "../sl/types.js";
import { error, slError, text } from "./result.js";

const place = z.union([z.number().int(), z.string().trim().min(1)]);

const inputSchema = z.object({
  from: place.describe("Start: a stop id from find_stop, or a street address like 'Götgatan 76, Stockholm'"),
  to: place.describe("Destination: a stop id from find_stop, or a street address"),
  time: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    .refine(isRealTime, "Not a real date and time")
    .optional()
    .describe("Stockholm time as YYYY-MM-DDTHH:MM. Leave out to leave now."),
  arriveBy: z.boolean().default(false).describe("true: arrive by `time`. false: leave at `time`."),
});

export function registerPlanTripTool(server: McpServer, sl: SlClient): void {
  server.registerTool(
    "plan_trip",
    {
      title: "Plan trip",
      description:
        "Plan a trip by SL public transport between two stops or street addresses, with every leg, change and walk. " +
        "For a stop, get its id from find_stop. For an address, pass it as text, with the town if it may be ambiguous. " +
        "Returns up to 3 trips. Times are Stockholm time.",
      inputSchema,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ from, to, time, arriveBy }) => {
      try {
        // Addresses are fuzzy matched ("Sellpy" finds Karusellplan), so say what each one matched.
        const matched: string[] = [];
        const resolve = async (place: number | string) => {
          // A client with an old schema may send a stop id as text, e.g. "9001".
          if (typeof place === "number" || /^\d+$/.test(place)) return Number(place);
          const found = await sl.findPlace(place);
          if (!found) throw new TripSearchError(`SL found no address or stop matching "${place}".`);
          matched.push(`"${place}" matched ${found.name}`);
          return found.id;
        };
        const trips = await sl.planTrip(await resolve(from), await resolve(to), { time, arriveBy });
        if (trips.length === 0) return text("No trips found.");
        const header = matched.length ? [matched.join("\n")] : [];
        return text([...header, ...trips.map((trip, i) => formatTrip(trip, i + 1))].join("\n\n"));
      } catch (cause) {
        if (cause instanceof TripSearchError) return error(cause.message);
        return slError(cause);
      }
    },
  );
}

/** Rejects e.g. "2026-02-30T25:99", which SL answers with a bare 400. */
function isRealTime(time: string): boolean {
  const date = new Date(`${time}:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(time);
}

// Trip 1: 22:57 -> 23:46 (49 min, 1 change)
//   22:57-23:04 Metro 17 towards Odenplan: Slussen, Stockholm -> Odenplan, Stockholm
function formatTrip(trip: Trip, n: number): string {
  const changes = trip.changes === 1 ? "1 change" : `${trip.changes} changes`;
  const legs = trip.legs.map((leg) => {
    const how = [leg.mode, leg.line, leg.towards && `towards ${leg.towards}`, leg.exit && `via exit ${leg.exit}`]
      .filter(Boolean)
      .join(" ");
    const from = leg.platform ? `${leg.from} (platform ${leg.platform})` : leg.from;
    return `  ${leg.departure}-${leg.arrival} ${how[0]!.toUpperCase()}${how.slice(1)}: ${from} -> ${leg.to}`;
  });
  return [`Trip ${n}: ${trip.departure} -> ${trip.arrival} (${trip.minutes} min, ${changes})`, ...legs].join("\n");
}
