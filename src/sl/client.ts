import type { Departure, Disruption, Stop, TransportMode } from "./types.js";

// SL's open APIs (no key needed). Docs: https://www.trafiklab.se/api/
//   GET {TRANSPORT_API}/sites?expand=false            all ~6 500 stops, no search parameter
//   GET {TRANSPORT_API}/sites/{siteId}/departures     upcoming departures
//   GET {DEVIATIONS_API}/messages?future=false        current disruptions
// Example responses: test/fixtures/
export const TRANSPORT_API = "https://transport.integration.sl.se/v1";
export const DEVIATIONS_API = "https://deviations.integration.sl.se/v1";

export interface SlClientOptions {
  /** Swap in a fake fetch in tests. */
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export class SlClient {
  private readonly fetch: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: SlClientOptions = {}) {
    this.fetch = options.fetch ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  /** Stops whose name matches the query, best matches first. */
  async findStop(query: string, limit = 5): Promise<Stop[]> {
    // TODO: fetch (and cache) all sites, match on a normalized name, map to Stop.
    throw new Error("not implemented");
  }

  async getDepartures(siteId: number): Promise<Departure[]> {
    // TODO: fetch departures for the site and map to Departure.
    throw new Error("not implemented");
  }

  async getDisruptions(filter: { line?: string; transportMode?: TransportMode } = {}): Promise<Disruption[]> {
    // TODO: fetch messages, filter, map to Disruption.
    throw new Error("not implemented");
  }

  /** GET a URL and parse JSON, with a timeout and a clear error on non-2xx. */
  private async getJson<T>(url: string): Promise<T> {
    // TODO: use this.fetch with AbortSignal.timeout(this.timeoutMs).
    throw new Error("not implemented");
  }
}
