#!/usr/bin/env node

// Entry point. Starts the server on stdio: the AI client (Claude Desktop, Claude Code, Cursor)
// launches this file as a process and talks to it over stdin/stdout.
// Everything else lives in createServer() so tests can use the server without stdio.

import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createServer } from "./server.js";

serveStdio(() => createServer(), {
  onerror: (error) => {
    console.error("Transport error:", error);
    process.exitCode = 1;
  },
});

// stdout is the MCP protocol channel, so log to stderr only.
console.error("sl-mcp running on stdio");
