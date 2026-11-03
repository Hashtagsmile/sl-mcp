import { describe, expect, it } from "vitest";
import { SlClient } from "../src/sl/client.js";
import departures from "./fixtures/departures.json" with { type: "json" };
import deviations from "./fixtures/deviations.json" with { type: "json" };
import stopFinder from "./fixtures/stop-finder.json" with { type: "json" };
import trips from "./fixtures/trips.json" with { type: "json" };

/** A client whose fetch answers with `body` and remembers the requested URLs. */
function fakeClient(body: unknown, status = 200) {
  const urls: string[] = [];
  const sl = new SlClient({
    retryDelaysMs: [0, 0],
    fetch: async (input) => {
      urls.push(String(input));
      return new Response(JSON.stringify(body), { status });
    },
  });
  return { sl, urls };
}

describe("SlClient", () => {
  it("findStop lets SL search and turns its ids into site ids", async () => {
    const { sl, urls } = fakeClient(stopFinder);
    const stops = await sl.findStop("arlanda");

    expect(urls[0]).toContain("/stop-finder?name_sf=arlanda");
    expect(stops[0]).toEqual({ id: 9511, name: "Sigtuna, Arlanda central (pendeltåg)", modes: ["commuter train", "train"] });
  });

  it("findStop skips stop areas without departures and keeps the 6-digit site id for aliases", async () => {
    const { sl } = fakeClient(stopFinder);
    const ids = (await sl.findStop("arlanda", 10)).map((s) => s.id);

    expect(ids).toEqual([9511, 5047, 5004, 5002, 5006]); // 9021001057308000 dropped, 9091001001005006 -> 5006
  });

  it("getDepartures passes the transport mode to SL and maps the response", async () => {
    const { sl, urls } = fakeClient(departures);
    const result = await sl.getDepartures(9192, { transportMode: "METRO" });

    expect(urls[0]).toContain("/sites/9192/departures?transport=METRO");
    expect(result[0]).toMatchObject({ line: "2", transportMode: "BUS", destination: "Norrtull", direction: 2, display: "3 min" });
  });

  it("getDepartures marks cancelled departures", async () => {
    const { sl } = fakeClient(departures);
    const cancelled = (await sl.getDepartures(9192)).filter((d) => d.cancelled);

    expect(cancelled).toHaveLength(1);
    expect(cancelled[0]).toMatchObject({ line: "18", destination: "Farsta strand", deviations: ["Inställd"] });
  });

  it("getDisruptions filters on line number", async () => {
    const { sl } = fakeClient(deviations);
    const result = await sl.getDisruptions({ lines: ["13"] });

    expect(result.map((d) => d.header)).toEqual(["Entré vid Östermalmstorg stängd"]);
    expect(result[0]!.lines).toEqual(["13", "14"]);
  });

  it("getDisruptions asks SL at most once a minute", async () => {
    const { sl, urls } = fakeClient(deviations);
    await sl.getDisruptions();
    await sl.getDisruptions({ lines: ["17"] });

    expect(urls).toHaveLength(1);
  });

  it("planTrip returns the legs in Stockholm time", async () => {
    const { sl, urls } = fakeClient(trips);
    const [trip] = await sl.planTrip(9192, 9511);

    expect(urls[0]).toContain("name_origin=9091001000009192");
    expect(urls[0]).toContain("name_destination=9091001000009511");
    expect(trip).toMatchObject({ departure: "22:57", arrival: "23:46", changes: 1 });
    expect(trip!.legs.map((l) => [l.mode, l.line])).toEqual([
      ["Tunnelbana", "17"],
      ["walk", undefined],
      ["Tåg", "40"],
    ]);
  });

  it("planTrip returns at most 3 trips even if SL sends more", async () => {
    const journey = trips.journeys[0];
    const { sl } = fakeClient({ ...trips, journeys: Array(6).fill(journey) });

    await expect(sl.planTrip(9192, 9511)).resolves.toHaveLength(3);
  });

  it("retries when SL answers 429", async () => {
    let calls = 0;
    const sl = new SlClient({
      retryDelaysMs: [0, 0],
      fetch: async () => (++calls === 1 ? new Response("", { status: 429 }) : new Response(JSON.stringify(departures))),
    });

    await expect(sl.getDepartures(9192)).resolves.toHaveLength(8);
    expect(calls).toBe(2);
  });

  it("throws a clear error on a non-2xx response", async () => {
    const { sl } = fakeClient({}, 500);

    await expect(sl.getDepartures(9192)).rejects.toThrow("SL API answered 500");
  });

  it("times out after timeoutMs", async () => {
    const sl = new SlClient({
      timeoutMs: 10,
      fetch: (_input, init) =>
        new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal!.reason))),
    });

    await expect(sl.getDepartures(9192)).rejects.toThrow();
  });
});
