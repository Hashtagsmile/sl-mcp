// Entry point for Cloudflare Workers: serves MCP over HTTP at /mcp, so web clients
// (claude.ai, ChatGPT) can connect with just a URL. The stdio entry is src/index.ts.

import { createMcpHandler } from "@modelcontextprotocol/server";
import { createServer } from "./server.js";
import { SlClient } from "./sl/client.js";

// One client per isolate, so its disruptions cache is shared between requests.
const sl = new SlClient();
const mcp = createMcpHandler(() => createServer(sl));

export default {
  fetch(request: Request): Promise<Response> | Response {
    const { pathname } = new URL(request.url);
    if (pathname === "/mcp") return mcp.fetch(request);
    // 404 elsewhere: clients probe e.g. /.well-known/oauth-protected-resource, and a 200 there means "log in first".
    if (pathname !== "/") return new Response("Not found\n", { status: 404 });
    return new Response("sl-mcp: an MCP server for Stockholm public transport. Connect your MCP client to /mcp.\n");
  },
};
