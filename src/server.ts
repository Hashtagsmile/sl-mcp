import { McpServer } from "@modelcontextprotocol/server";
import { SlClient } from "./sl/client.js";
import { registerTools } from "./tools/index.js";

export const SERVER_VERSION = "0.1.0";

/**
 * Builds a server with all tools registered, without connecting it to a transport.
 * Pass a client to use test data instead of the real SL APIs.
 */
export function createServer(sl: SlClient = new SlClient()): McpServer {
  const server = new McpServer({ name: "sl-mcp", version: SERVER_VERSION });
  registerTools(server, sl);
  return server;
}
