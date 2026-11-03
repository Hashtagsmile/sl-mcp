import { McpServer } from "@modelcontextprotocol/server";
import { SlClient } from "./sl/client.js";
import { registerTools } from "./tools/index.js";

export const SERVER_VERSION = "0.2.0";

// How the model should answer, so travel answers are short and easy to follow.
const INSTRUCTIONS = `Answer travel questions like a friend who knows SL, in the user's language.
1. First line: the direct answer. "When must I leave?" -> the time to leave. "How do I get to X?" -> leave HH:MM, arrive HH:MM.
2. Then the best trip as numbered steps, one per leg: time, line and direction, platform or track, where to get on and off, walks with minutes and which exit (uppgång) to use.
3. At most one alternative, in one line, e.g. the next trip if you miss it.
The best trip arrives in time with the fewest changes. Use only times and places the tools returned: never guess a walk or a time.
For a street address, pass it to plan_trip instead of planning to a nearby stop. Mention delays, disruptions and crowding (few seats, standing only) only if they affect the trip.`;

/**
 * Builds a server with all tools registered, without connecting it to a transport.
 * Pass a client to use test data instead of the real SL APIs.
 */
export function createServer(sl: SlClient = new SlClient()): McpServer {
  const server = new McpServer({ name: "sl-mcp", version: SERVER_VERSION }, { instructions: INSTRUCTIONS });
  registerTools(server, sl);
  return server;
}
