import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { SlClient } from "../sl/client.js";
import type { Departure } from "../sl/types.js";
import { slError, text } from "./result.js";

const inputSchema = z.object({
  siteId: z.number().int().describe("Stop id from find_stop"),
  transportMode: z.enum(["METRO", "BUS", "TRAIN", "TRAM", "SHIP", "FERRY"]).optional().describe("Only this mode"),
  line: z.string().optional().describe("Only this line number, e.g. '14' or '43X'"),
  towards: z.string().optional().describe("Only departures whose final destination contains this, e.g. 'Ropsten'"),
  minutes: z.number().int().min(1).max(180).default(60).describe("How far ahead to look"),
  limit: z.number().int().min(1).max(30).default(10).describe("Maximum number of departures"),
});

export function registerGetDeparturesTool(server: McpServer, sl: SlClient): void {
  server.registerTool(
    "get_departures",
    {
      title: "Get departures",
      description:
        "Live departures from an SL stop, soonest first, with delays and cancellations. " +
        "SL returns at most 3 departures per line and direction. " +
        "`towards` matches the final destination only. For a station on the way (e.g. 'mot T-Centralen' from Slussen), " +
        "leave it out and pick the right direction (1 or 2) from the results.",
      inputSchema,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ siteId, transportMode, line, towards, minutes, limit }) => {
      try {
        let departures = await sl.getDepartures(siteId, { transportMode, forecastMinutes: minutes });
        if (line) departures = departures.filter((d) => d.line === line);
        if (towards) departures = departures.filter((d) => normalize(d.destination).includes(normalize(towards)));
        if (departures.length === 0) {
          // SL answers an unknown id with no departures too, so say so.
          return text(
            `No departures from stop ${siteId} in the next ${minutes} minutes with these filters. ` +
              "If the id did not come from find_stop, it may not exist.",
          );
        }
        return text(departures.slice(0, limit).map(formatDeparture).join("\n"));
      } catch (cause) {
        return slError(cause);
      }
    },
  );
}

// "14 METRO to Mörby centrum (direction 1): 3 min, 2 min late"
function formatDeparture(d: Departure): string {
  const notes: string[] = [];
  if (d.cancelled) notes.push("CANCELLED");
  const lateMinutes = Math.round((Date.parse(d.expected) - Date.parse(d.scheduled)) / 60_000);
  if (!d.cancelled && lateMinutes > 0) notes.push(`${lateMinutes} min late`);
  notes.push(...d.deviations);
  const when = [d.display, ...notes].join(", ");
  return `${d.line} ${d.transportMode} to ${d.destination} (direction ${d.direction}): ${when}`;
}

/** Lowercase without accents, so "sodertalje" matches "Södertälje". */
function normalize(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}
