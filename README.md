# sl-mcp

MCP server that lets AI assistants (Claude, Cursor, VS Code) answer questions about Stockholm
public transport, using SL's open APIs.

> Work in progress.

## Tools

| Tool | Description |
|---|---|
| `find_stop` | TODO |
| `get_departures` | TODO |
| `get_disruptions` | TODO |

## Getting started

Requires Node.js 20 or later.

```
npm install
npm run build
npm test
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
    types.ts        Stop, Departure, Disruption
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

TODO

## Data

Data from SL's open APIs via [Trafiklab](https://www.trafiklab.se/).
