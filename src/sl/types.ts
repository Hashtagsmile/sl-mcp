// Our own narrow types. The tools return these, never the raw API objects,
// so the model gets fewer tokens and the API can change without breaking the tools.

export type TransportMode = "METRO" | "BUS" | "TRAIN" | "TRAM" | "SHIP";

export interface Stop {
  id: number;
  name: string;
  note?: string;
}

export interface Departure {
  line: string;
  transportMode: TransportMode;
  destination: string;
  display: string; // "3 min" or "19:50"
  expected: string; // ISO time
  cancelled: boolean;
  deviations: string[];
}

export interface Disruption {
  header: string;
  details: string;
  lines: string[];
  until?: string;
}
