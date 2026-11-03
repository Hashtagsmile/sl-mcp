# sl-mcp

MCP server that lets AI assistants (Claude, Cursor, VS Code) answer questions about Stockholm
public transport, using SL's open APIs.

> Work in progress.

## Tools

| Tool | What it does |
|---|---|
| `find_stop` | Searches stops by name (SL's own search, typos are fine) and returns their ids |
| `get_departures` | Live departures from a stop, filtered by mode, line or destination |
| `get_disruptions` | Announced disruptions, filtered by line numbers or mode |
| `plan_trip` | Trips between two stops, with every leg, change and walk |

Example questions: "When does the next metro leave Slussen towards Ropsten?", "Is the red line disrupted?",
"How do I get from Odenplan to Arlanda?"

## Use it with Claude

Build first (`npm run build`), then add the server to your client.

Claude Code:

```
claude mcp add sl -- node /path/to/sl-mcp/dist/index.js
```

Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "sl": { "command": "node", "args": ["/path/to/sl-mcp/dist/index.js"] }
  }
}
```

## Getting started

Requires Node.js 20 or later.

```
npm install
npm run build
npm test
npm run dev       # recompiles on save
npm run inspect   # opens the MCP Inspector against the built server
```

## Project structure

```
src/
  index.ts          entry point: serves the server over stdio
  server.ts         createServer(): builds the server and registers the tools
  tools/            one file per tool (schema, description, handler)
    result.ts       helpers for text and error results
  sl/
    client.ts       SlClient: calls SL's APIs and maps responses to our types
    types.ts        Stop, Departure, Disruption, Trip
  lib/
    cache.ts        TtlCache
test/
  harness.ts        connects a real MCP client to the server in memory
  fixtures/         recorded API responses
```

The entry point only wires up stdio. Everything else is built by `createServer()`, so tests can
connect a real MCP client over an in-memory transport without touching stdin/stdout. The tools
depend on `SlClient`, which takes a `fetch` function, so tests run on recorded responses instead
of the live API.

## Design decisions

- **SL does the searching and filtering.** `find_stop` uses SL's stop-finder instead of downloading all
  6 500 stops, and departures are filtered by the API. Responses stay small (a few KB) and fast.
- **One id everywhere.** stop-finder ids like `9091001000009192` are turned into the site id `9192`,
  which both `get_departures` and `plan_trip` take.
- **Small text results.** Tools return short lines of text, not raw API JSON, so the model reads less.
- **Only one cache.** Disruptions are cached for 60 s because SL asks for at most one request a minute.
  Departures are always fresh.
- **Retries on 429.** SL sometimes answers "Quota has been exceeded", so requests are retried twice.
- **Not included:** "nearest stop to me". SL has no keyless endpoint for it.

## Data

Data from SL's open APIs via [Trafiklab](https://www.trafiklab.se/).
