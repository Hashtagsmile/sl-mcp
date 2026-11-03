import type { CallToolResult } from "@modelcontextprotocol/server";

/** A plain text result for the model. */
export function text(value: string): CallToolResult {
  return { content: [{ type: "text", text: value }] };
}

/** An error the model can read and act on, instead of a crashed server. */
export function error(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

/** Placeholder until a tool is implemented. Remove when all tools are done. */
export function notImplemented(tool: string): CallToolResult {
  return error(`${tool} is not implemented yet`);
}
