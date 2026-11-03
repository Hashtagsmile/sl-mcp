import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { SlClient } from "../sl/client.js";
import { slError, text } from "./result.js";

const inputSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1)
    .describe("Stop or station name, e.g. 'Slussen' or 'Arlanda'. Typos are fine, abbreviations are not."),
  limit: z.number().int().min(1).max(10).default(5).describe("Maximum number of stops to return"),
});

export function registerFindStopTool(server: McpServer, sl: SlClient): void {
  server.registerTool(
    "find_stop",
    {
      title: "Find stop",
      description:
        "Search Stockholm public transport (SL) stops by name. Returns each stop's id, name and transport modes. " +
        "Stop names only, not street addresses: for an address, search the nearest station or stop. " +
        "Write names out: 'Tekniska högskolan', not 'KTH'. " +
        "Call this first: get_departures and plan_trip need the id. " +
        "A name can match several stops (e.g. 'Arlanda' gives the train station and bus stops). " +
        "Pick the one whose name and modes fit the question, or ask the user.",
      inputSchema,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ query, limit }) => {
      try {
        const stops = await sl.findStop(query, limit);
        if (stops.length === 0) return text(`No stops found for "${query}". Try another spelling or a nearby station.`);
        return text(stops.map((s) => `${s.id}: ${s.name} (${s.modes.join(", ") || "unknown modes"})`).join("\n"));
      } catch (cause) {
        return slError(cause);
      }
    },
  );
}
