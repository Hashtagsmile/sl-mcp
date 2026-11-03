/**
 * A small in-memory cache with a time-to-live per entry.
 * Stops change rarely (cache for a day); departures change all the time (cache for seconds).
 */
export class TtlCache<T> {
  private readonly entries = new Map<string, { value: T; expiresAt: number }>();

  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: string): T | undefined {
    // TODO: return the value if it has not expired, otherwise delete it and return undefined.
    throw new Error("not implemented");
  }

  set(key: string, value: T): void {
    // TODO: store the value with expiresAt = now() + ttlMs.
    throw new Error("not implemented");
  }
}
