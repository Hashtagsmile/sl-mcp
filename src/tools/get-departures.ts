import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { SlClient } from "../sl/client.js";
import { notImplemented } from "./result.js";

const inputSchema = z.object({
  siteId: z.number().int().describe("TODO: the id returned by find_stop"),
  transportMode: z.enum(["METRO", "BUS", "TRAIN", "TRAM", "SHIP"]).optional().describe("TODO"),
  limit: z.number().int().min(1).max(20).default(10).describe("TODO"),
});

export function registerGetDeparturesTool(server: McpServer, sl: SlClient): void {
  server.registerTool(
    "get_departures",
    {
      title: "Get departures",
      description: "TODO",
      inputSchema,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ siteId, transportMode, limit }) => {
      // TODO: call sl.getDepartures(siteId), filter on transportMode, keep `limit` rows.
      void sl;
      void siteId;
      void transportMode;
      void limit;
      return notImplemented("get_departures");
    },
  );
}
