import type { CallToolResult } from "@modelcontextprotocol/client";
import { afterEach, describe, expect, it } from "vitest";
import { SlClient } from "../src/sl/client.js";
import departures from "./fixtures/departures.json" with { type: "json" };
import deviations from "./fixtures/deviations.json" with { type: "json" };
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

  it("find_stop rejects a blank query", async () => {
    session = await connect(fakeSl);
    const { isError } = await call("find_stop", { query: "   " });
    expect(isError).toBe(true);
  });

  it("get_departures filters on destination and shows cancellations", async () => {
    session = await connect(fakeSl);
    const { text } = await call("get_departures", { siteId: 9192, towards: "farsta" });
    expect(text).toBe("18 METRO to Farsta strand (direction 2): 19:50, CANCELLED");
  });

  it("plan_trip lists every leg", async () => {
    session = await connect(fakeSl);
    const { text } = await call("plan_trip", { from: 9192, to: 9511 });
    expect(text.split("\n")).toEqual([
      "Trip 1: 22:57 -> 23:46 (49 min, 1 change)",
      "  22:57-23:04 Metro 17 towards Odenplan: Slussen, Stockholm -> Odenplan, Stockholm",
      "  23:06-23:10 Walk: Odenplan, Stockholm -> Stockholm Odenplan",
      "  23:10-23:46 Commuter train 40 towards Uppsala C: Stockholm Odenplan -> Arlanda central, Sigtuna",
    ]);
  });

  it("plan_trip says which place an address matched", async () => {
    const place = { locations: [{ id: "streetID:1", name: "Stockholm, Götgatan 76" }] };
    const sl = new SlClient({
      fetch: async (input) => new Response(JSON.stringify(String(input).includes("/stop-finder") ? place : trips)),
    });
    session = await connect(sl);
    const { text } = await call("plan_trip", { from: 9192, to: "Götgatan 76" });
    expect(text).toMatch(/^"Götgatan 76" matched Stockholm, Götgatan 76\n\nTrip 1:/);
  });

  it("plan_trip explains an error SL gives a code for", async () => {
    const body = { systemMessages: [{ type: "error", code: -8020, text: "origin: no matches" }] };
    session = await connect(new SlClient({ fetch: async () => new Response(JSON.stringify(body)) }));
    const { text, isError } = await call("plan_trip", { from: 1, to: 9511 });
    expect(isError).toBe(true);
    expect(text).toBe("SL does not know one of the stop ids. Get them from find_stop.");
  });

  it("plan_trip rejects a date that does not exist", async () => {
    session = await connect(fakeSl);
    const { text, isError } = await call("plan_trip", { from: 9192, to: 9511, time: "2026-02-30T25:99" });
    expect(isError).toBe(true);
    expect(text).toContain("Not a real date and time");
  });

  it("get_disruptions understands metro colours", async () => {
    session = await connect(new SlClient({ fetch: async () => new Response(JSON.stringify(deviations)) }));
    const { text } = await call("get_disruptions", { lines: ["grön linje"] });
    expect(text).toMatch(/^Lines 19, 18, 17: Avstängd hiss vid Brommaplan/);
    expect(text).not.toContain("Östermalmstorg");
  });

  it("returns an error result when SL is down", async () => {
    session = await connect(new SlClient({ fetch: async () => new Response("", { status: 503 }) }));
    const { text, isError } = await call("get_departures", { siteId: 9192 });
    expect(isError).toBe(true);
    expect(text).toContain("Could not get data from SL");
  });
});
