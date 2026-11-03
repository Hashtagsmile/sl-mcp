import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { SlClient } from "../sl/client.js";
import { notImplemented } from "./result.js";

const inputSchema = z.object({
  query: z.string().describe("TODO: describe for the model, e.g. part of a stop name"),
  limit: z.number().int().min(1).max(10).default(5).describe("TODO"),
});

export function registerFindStopTool(server: McpServer, sl: SlClient): void {
  server.registerTool(
    "find_stop",
    {
      title: "Find stop",
      // TODO: tell the model what this returns and when to use it (before get_departures).
      description: "TODO",
      inputSchema,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ query, limit }) => {
      // TODO: call sl.findStop(query, limit) and return the stops as text.
      void sl;
      void query;
      void limit;
      return notImplemented("find_stop");
    },
  );
}
