import { describe, expect, it } from "vitest";
import { TtlCache } from "../src/lib/cache.js";

describe("TtlCache", () => {
  it("returns a value before it expires", () => {
    let now = 0;
    const cache = new TtlCache<string>(1000, () => now);
    cache.set("a", "value");
    now = 999;
    expect(cache.get("a")).toBe("value");
  });

  it("returns undefined after it expires", () => {
    let now = 0;
    const cache = new TtlCache<string>(1000, () => now);
    cache.set("a", "value");
    now = 1000;
    expect(cache.get("a")).toBeUndefined();
  });
});
