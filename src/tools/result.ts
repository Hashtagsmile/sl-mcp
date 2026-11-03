import type { CallToolResult } from "@modelcontextprotocol/server";

/** A plain text result for the model. */
export function text(value: string): CallToolResult {
  return { content: [{ type: "text", text: value }] };
}

/** An error the model can read and act on, instead of a crashed server. */
export function error(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

/** Turns a failed SL request into an error result. */
export function slError(cause: unknown): CallToolResult {
  const reason = cause instanceof Error ? cause.message : String(cause);
  return error(`Could not get data from SL: ${reason}`);
}
