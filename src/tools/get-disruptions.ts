import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { SlClient } from "../sl/client.js";
import { notImplemented } from "./result.js";

const inputSchema = z.object({
  line: z.string().optional().describe("TODO: e.g. a line number like 14"),
  transportMode: z.enum(["METRO", "BUS", "TRAIN", "TRAM", "SHIP"]).optional().describe("TODO"),
});

export function registerGetDisruptionsTool(server: McpServer, sl: SlClient): void {
  server.registerTool(
    "get_disruptions",
    {
      title: "Get disruptions",
      description: "TODO",
      inputSchema,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ line, transportMode }) => {
      // TODO: call sl.getDisruptions({ line, transportMode }) and keep each message short.
      void sl;
      void line;
      void transportMode;
      return notImplemented("get_disruptions");
    },
  );
}
