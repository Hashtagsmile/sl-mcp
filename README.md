# sl-mcp

An MCP server for Stockholm public transport (SL). Connect it to Claude or another MCP client and ask
about departures, disruptions and trips in plain Swedish or English.

```
När går nästa tunnelbana från Slussen mot Ropsten?
Är det några störningar på röda linjen?
How do I get from Odenplan to Arlanda?
```

It uses SL's open APIs, which don't need an API key.

## Tools

- `find_stop`: search for a stop by name and get its id
- `get_departures`: upcoming departures from a stop, optionally by mode, line or destination
- `get_disruptions`: announced disruptions for one or more lines
- `plan_trip`: trips between two stops, with changes and walks

## Install

Requires Node.js 20 or later.

```
git clone https://github.com/Hashtagsmile/sl-mcp.git
cd sl-mcp
npm install
npm run build
```

### Claude Code

```
claude mcp add sl -- node /path/to/sl-mcp/dist/index.js
```

### Claude Desktop

Add this to `claude_desktop_config.json` and restart Claude Desktop:

```json
{
  "mcpServers": {
    "sl": {
      "command": "node",
      "args": ["/path/to/sl-mcp/dist/index.js"]
    }
  }
}
```

## Development

```
npm run dev       # compile on save
npm test          # run the tests
npm run inspect   # try the tools in the MCP Inspector
```

The tests use recorded API responses in `test/fixtures/`, so they don't call SL.

## Limitations

- SL returns at most 3 departures per line and direction.
- Disruption messages are in Swedish only.
- There is no "nearest stop" search, since SL has no keyless API for it.

## Data

Data from SL via [Trafiklab](https://www.trafiklab.se/).

## License

MIT
