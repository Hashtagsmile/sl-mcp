import type { McpServer } from "@modelcontextprotocol/server";
import type { SlClient } from "../sl/client.js";
import { registerFindStopTool } from "./find-stop.js";
import { registerGetDeparturesTool } from "./get-departures.js";
import { registerGetDisruptionsTool } from "./get-disruptions.js";

export function registerTools(server: McpServer, sl: SlClient): void {
  registerFindStopTool(server, sl);
  registerGetDeparturesTool(server, sl);
  registerGetDisruptionsTool(server, sl);
}
