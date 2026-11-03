import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { SlClient } from "../sl/client.js";
import { slError, text } from "./result.js";

// Long enough for nearly all of SL's messages (p90 is under 300) but keeps an unfiltered list short.
const MAX_DETAILS = 800;

// So "grön linje" or "red line" work as well as line numbers.
const METRO_COLOURS: [RegExp, string[]][] = [
  [/r[öo]d|red/i, ["13", "14"]],
  [/gr[öo]n|green/i, ["17", "18", "19"]],
  [/bl[åa]|blue/i, ["10", "11"]],
];

const inputSchema = z.object({
  lines: z
    .array(z.string())
    .optional()
    .describe("Only these line numbers, e.g. ['13', '14'], or metro colours, e.g. ['grön linje']"),
  transportMode: z.enum(["METRO", "BUS", "TRAIN", "TRAM", "SHIP", "FERRY"]).optional().describe("Only this mode"),
});

export function registerGetDisruptionsTool(server: McpServer, sl: SlClient): void {
  server.registerTool(
    "get_disruptions",
    {
      title: "Get disruptions",
      description:
        "List disruptions SL has announced: track work, closed entrances, broken lifts and replacement buses, " +
        "with the lines affected and until when. Use it to check a line or the stops of a trip before travelling, " +
        "e.g. lifts for a wheelchair. For live delays and cancelled departures, use get_departures instead. " +
        "The text is in Swedish, so translate it if needed, and is cut at 800 characters. " +
        "Results are cached for 1 minute, as SL asks. Leave both filters out to list everything.",
      inputSchema,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ lines, transportMode }) => {
      try {
        const disruptions = await sl.getDisruptions({ lines: lines?.flatMap(lineNumbers), transportMode });
        if (disruptions.length === 0) return text("No announced disruptions match.");
        return text(
          disruptions
            .map((d) => {
              const details = d.details.length > MAX_DETAILS ? `${d.details.slice(0, MAX_DETAILS)}…` : d.details;
              const until = d.until ? ` (until ${d.until.slice(0, 10)})` : "";
              const label = d.lines.length === 1 ? "Line" : "Lines";
              return `${label} ${d.lines.join(", ") || "-"}: ${d.header}${until}\n${details}`;
            })
            .join("\n\n"),
        );
      } catch (cause) {
        return slError(cause);
      }
    },
  );
}

function lineNumbers(line: string): string[] {
  return METRO_COLOURS.find(([colour]) => colour.test(line))?.[1] ?? [line];
}
