import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { createServer } from "../src/server.js";
import { SlClient } from "../src/sl/client.js";

/**
 * Connects a real MCP client to the server in memory, the same way Claude would over stdio.
 * Tests assert only on what crosses the wire: tool lists and tool results.
 */
export async function connect(sl: SlClient = new SlClient()) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer(sl);
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}
