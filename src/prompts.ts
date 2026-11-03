import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

// Ready-made questions a user can pick in their client, e.g. as a slash command.
// Prompt arguments are always text in MCP.

export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    "trip",
    {
      title: "Plan a trip",
      description: "How to get from one place to another by SL, optionally arriving by a given time",
      argsSchema: z.object({
        from: z.string().describe("Start: a stop, station or street address, e.g. 'Sundbyberg'"),
        to: z.string().describe("Destination: a stop, station or street address, e.g. 'Götgatan 76'"),
        arriveBy: z.string().optional().describe("Arrive by this time, e.g. '09:00' or 'tomorrow 08:30'"),
      }),
    },
    ({ from, to, arriveBy }) =>
      userMessage(`How do I get from ${from} to ${to} by SL${arriveBy ? `, arriving by ${arriveBy}` : ""}?`),
  );

  server.registerPrompt(
    "departures",
    {
      title: "Next departures",
      description: "The next departures from one SL stop or station",
      argsSchema: z.object({
        stop: z.string().describe("Stop or station, e.g. 'Slussen'"),
      }),
    },
    ({ stop }) => userMessage(`When are the next departures from ${stop}?`),
  );
}

function userMessage(text: string) {
  return { messages: [{ role: "user" as const, content: { type: "text" as const, text } }] };
}
