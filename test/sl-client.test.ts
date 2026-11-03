import { describe, it } from "vitest";

// Use the responses in test/fixtures/ with a fake fetch:
//   new SlClient({ fetch: async () => new Response(JSON.stringify(fixture)) })

describe("SlClient", () => {
  it.todo("findStop matches 'slussen' and 'SLUSSEN' the same way");
  it.todo("findStop ranks names that start with the query first");
  it.todo("getDepartures maps the API response to Departure");
  it.todo("getDepartures marks cancelled departures");
  it.todo("getDisruptions filters on line");
  it.todo("throws a clear error on a non-2xx response");
  it.todo("times out after timeoutMs");
});
