#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({ name: "sl-mcp", version: "0.1.0" });

// TODO: register tools here with server.registerTool(name, { description, inputSchema }, handler)
//   - find_stop
//   - get_departures
//   - get_disruptions

const transport = new StdioServerTransport();
await server.connect(transport);

// stdout is the MCP protocol channel, so log to stderr only.
console.error("sl-mcp running on stdio");
