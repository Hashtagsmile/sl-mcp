import { afterEach, describe, expect, it } from "vitest";
import { connect } from "./harness.js";

let session: Awaited<ReturnType<typeof connect>>;

afterEach(async () => {
  await session?.close();
});

describe("server", () => {
  it("lists the three tools", async () => {
    session = await connect();
    const { tools } = await session.client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["find_stop", "get_departures", "get_disruptions"]);
  });

  it.todo("find_stop returns stops for 'slussen'");
  it.todo("get_departures returns an error result for an unknown site id");
});
