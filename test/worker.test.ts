import { describe, expect, it } from "vitest";
import worker from "../src/worker.js";

function post(body: unknown) {
  return worker.fetch(
    new Request("https://sl-mcp.example/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": "2025-06-18",
      },
      body: JSON.stringify(body),
    }),
  );
}

describe("worker", () => {
  it("serves MCP over HTTP at /mcp", async () => {
    const response = await post({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(response.status).toBe(200);
    const text = await response.text();
    for (const tool of ["find_stop", "get_departures", "get_disruptions", "plan_trip"]) expect(text).toContain(tool);
  });

  it("says where the MCP endpoint is at /", async () => {
    const response = await worker.fetch(new Request("https://sl-mcp.example/"));
    expect(await response.text()).toContain("/mcp");
  });

  it("answers 404 to OAuth discovery, since no login is needed", async () => {
    const response = await worker.fetch(new Request("https://sl-mcp.example/.well-known/oauth-protected-resource"));
    expect(response.status).toBe(404);
  });
});
