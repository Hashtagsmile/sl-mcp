import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { SlClient } from "../sl/client.js";
import { slError, text } from "./result.js";

const MAX_DETAILS = 300;

const inputSchema = z.object({
  lines: z.array(z.string()).optional().describe("Only these line numbers, e.g. ['13', '14'] for the red metro line"),
  transportMode: z.enum(["METRO", "BUS", "TRAIN", "TRAM", "SHIP", "FERRY"]).optional().describe("Only this mode"),
});

export function registerGetDisruptionsTool(server: McpServer, sl: SlClient): void {
  server.registerTool(
    "get_disruptions",
    {
      title: "Get disruptions",
      description:
        "Announced SL disruptions: track work, closed entrances, broken lifts, replacement buses. " +
        "Not live delays: use get_departures for those. The text is in Swedish, so translate it if needed. " +
        "Metro colours: red line = 13, 14; green line = 17, 18, 19; blue line = 10, 11.",
      inputSchema,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ lines, transportMode }) => {
      try {
        const disruptions = await sl.getDisruptions({ lines, transportMode });
        if (disruptions.length === 0) return text("No announced disruptions match.");
        return text(
          disruptions
            .map((d) => {
              const details = d.details.length > MAX_DETAILS ? `${d.details.slice(0, MAX_DETAILS)}…` : d.details;
              const until = d.until ? ` (until ${d.until.slice(0, 10)})` : "";
              return `Lines ${d.lines.join(", ") || "-"}: ${d.header}${until}\n${details}`;
            })
            .join("\n\n"),
        );
      } catch (cause) {
        return slError(cause);
      }
    },
  );
}
