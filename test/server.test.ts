import type { CallToolResult } from "@modelcontextprotocol/client";
import { afterEach, describe, expect, it } from "vitest";
import { SlClient } from "../src/sl/client.js";
import departures from "./fixtures/departures.json" with { type: "json" };
import stopFinder from "./fixtures/stop-finder.json" with { type: "json" };
import trips from "./fixtures/trips.json" with { type: "json" };
import { connect } from "./harness.js";

let session: Awaited<ReturnType<typeof connect>>;

afterEach(async () => {
  await session?.close();
});

/** Answers each SL endpoint with its fixture. */
const fakeSl = new SlClient({
  fetch: async (input) => {
    const url = String(input);
    const body = url.includes("/stop-finder") ? stopFinder : url.includes("/trips") ? trips : departures;
    return new Response(JSON.stringify(body));
  },
});

async function call(name: string, args: Record<string, unknown>) {
  const result = (await session.client.callTool({ name, arguments: args })) as CallToolResult;
  const first = result.content[0];
  return { text: first?.type === "text" ? first.text : "", isError: result.isError ?? false };
}

describe("server", () => {
  it("lists the four tools", async () => {
    session = await connect();
    const { tools } = await session.client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["find_stop", "get_departures", "get_disruptions", "plan_trip"]);
  });

  it("find_stop returns stop ids", async () => {
    session = await connect(fakeSl);
    const { text } = await call("find_stop", { query: "arlanda", limit: 2 });
    expect(text).toBe("9511: Sigtuna, Arlanda central (pendeltåg) (commuter train, train)\n5047: Sigtuna, Arlandagymnasiet (bus)");
  });

  it("get_departures filters on destination and shows cancellations", async () => {
    session = await connect(fakeSl);
    const { text } = await call("get_departures", { siteId: 9192, towards: "farsta" });
    expect(text).toBe("18 METRO to Farsta strand (direction 2): 19:50, CANCELLED, Inställd");
  });

  it("plan_trip lists every leg", async () => {
    session = await connect(fakeSl);
    const { text } = await call("plan_trip", { fromSiteId: 9192, toSiteId: 9511 });
    expect(text.split("\n")).toEqual([
      "Trip 1: 22:57 -> 23:46 (49 min, 1 change)",
      "  22:57-23:04 Tunnelbana 17 towards Odenplan: Slussen, Stockholm -> Odenplan, Stockholm",
      "  23:06-23:10 Walk: Odenplan, Stockholm -> Stockholm Odenplan, Stockholm",
      "  23:10-23:46 Tåg 40 towards Uppsala C: Stockholm Odenplan, Stockholm -> Arlanda central, Sigtuna",
    ]);
  });

  it("returns an error result when SL is down", async () => {
    session = await connect(new SlClient({ fetch: async () => new Response("", { status: 503 }) }));
    const { text, isError } = await call("get_departures", { siteId: 9192 });
    expect(isError).toBe(true);
    expect(text).toContain("Could not get data from SL");
  });
});
