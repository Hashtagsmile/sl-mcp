import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { type SlClient, TripSearchError } from "../sl/client.js";
import type { Trip } from "../sl/types.js";
import { error, slError, text } from "./result.js";

const inputSchema = z.object({
  fromSiteId: z.number().int().describe("Start stop id from find_stop"),
  toSiteId: z.number().int().describe("Destination stop id from find_stop"),
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
        "Plan a trip by SL public transport between two stops, with every leg, change and walk. " +
        "Use find_stop to get both ids first. Returns up to 3 trips. Times are Stockholm time.",
      inputSchema,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ fromSiteId, toSiteId, time, arriveBy }) => {
      try {
        const trips = await sl.planTrip(fromSiteId, toSiteId, { time, arriveBy });
        if (trips.length === 0) return text("No trips found between these stops.");
        return text(trips.map((trip, i) => formatTrip(trip, i + 1)).join("\n\n"));
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
//   22:57-23:04 Tunnelbana 17 towards Odenplan: Slussen -> Odenplan
function formatTrip(trip: Trip, n: number): string {
  const changes = trip.changes === 1 ? "1 change" : `${trip.changes} changes`;
  const legs = trip.legs.map((leg) => {
    const how = leg.mode === "walk" ? "Walk" : `${leg.mode} ${leg.line ?? ""}${leg.towards ? ` towards ${leg.towards}` : ""}`;
    return `  ${leg.departure}-${leg.arrival} ${how.trim()}: ${leg.from} -> ${leg.to}`;
  });
  return [`Trip ${n}: ${trip.departure} -> ${trip.arrival} (${trip.minutes} min, ${changes})`, ...legs].join("\n");
}
