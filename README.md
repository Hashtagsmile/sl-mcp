# sl-mcp

[![CI](https://github.com/Hashtagsmile/sl-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Hashtagsmile/sl-mcp/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/Hashtagsmile/sl-mcp)](https://github.com/Hashtagsmile/sl-mcp/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![sl-mcp MCP server score](https://glama.ai/mcp/servers/Hashtagsmile/sl-mcp/badges/score.svg)](https://glama.ai/mcp/servers/Hashtagsmile/sl-mcp)

An MCP server for Stockholm public transport (SL). Connect it to Claude or another MCP client and ask
about departures, disruptions and trips in plain Swedish or English.

```
När går nästa tunnelbana från Slussen mot Ropsten?
Är det några störningar på röda linjen?
How do I get from Odenplan to Arlanda?
Hur tar jag mig från Sundbyberg till Götgatan 76?
```

It uses SL's open APIs, which don't need an API key.

An answer looks like this:

> **Gå 08:31 från Sundbybergs centrum, så är du framme på Götgatan 76 kl 08:58.**
> 1. **08:31** Tunnelbana 10 mot Kungsträdgården från **spår 2**. Åk 7 stationer till T-Centralen.
> 2. **08:47** Byt till tunnelbana 17 mot Skarpnäck från **spår 4**. Åk 3 stationer till Medborgarplatsen.
> 3. **08:52–08:58** Gå ut via uppgång **Folkungagatan Götgatan** och gå 6 min till Götgatan 76.

## Use it without installing

A hosted server runs on Cloudflare Workers. No API key or login is needed:

```
https://sl-mcp.miltonlindblad.workers.dev/mcp
```

Add it as a custom connector in claude.ai or ChatGPT, or in any MCP client that supports
Streamable HTTP. In Claude Code:

```
claude mcp add --transport http sl https://sl-mcp.miltonlindblad.workers.dev/mcp
```

## Tools

- `find_stop`: search for a stop by name, typos are fine, and get its id
- `get_departures`: live departures from a stop with platform or bus stop letter, delays and cancellations.
  Filter by mode, line or destination
- `get_disruptions`: announced disruptions such as track work, broken lifts and replacement buses, by line,
  mode or metro colour ("grön linje")
- `plan_trip`: up to 3 trips between stops or street addresses, leaving or arriving at a given time. Each ride
  shows platform, stops, crowding and delay, and each walk shows minutes and which station exit to use.
  You can ask for only some modes (e.g. boat) and for fewest changes or least walking

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

### Deploy to Cloudflare Workers

`src/worker.ts` serves the same tools over HTTP at `/mcp`.

```
npx wrangler dev      # run it locally on http://localhost:8787/mcp
npx wrangler deploy   # deploy to your Cloudflare account
```

## Limitations

- SL returns at most 3 departures per line and direction.
- Disruption messages are in Swedish only.
- There is no "nearest stop" search, since SL has no keyless API for it.
- SL can't plan step-free trips. For a wheelchair, the tools suggest least walking and checking for broken lifts.
- Addresses work, business names don't: "Götgatan 76" works, "Sellpy" doesn't.
- Departures reach at most 3 hours ahead. For later, use `plan_trip` with a time.

## Data

Data from SL via [Trafiklab](https://www.trafiklab.se/).

## License

MIT
