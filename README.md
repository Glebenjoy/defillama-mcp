# DefiLlama MCP

An [MCP](https://modelcontextprotocol.io) server that gives Claude, Cursor, and any
MCP-compatible agent **live DeFi data from [DefiLlama](https://defillama.com)** —
chain and protocol TVL, token prices, yield/farming pools, and stablecoin supply.

No API key. No signup. The public DefiLlama API is free.

> Most "MCP for X" repos are half-finished and break on the second request. This one ships
> with tests and graceful error handling so an agent can actually rely on it.

## What your agent can do

Ask things like:

- "Which chains have the most TVL right now?"
- "What's Aave's TVL and how did it move this week?"
- "Find the highest-APY stablecoin pools on Ethereum with at least $10M TVL."
- "Price of BTC and ETH?" (`coingecko:bitcoin,coingecko:ethereum`)
- "List the biggest stablecoins by circulating supply."

## Tools

| Tool | What it does |
|------|--------------|
| `get_chains_tvl` | TVL across all blockchains, ranked |
| `search_protocols` | Search protocols by name / symbol / category, ranked by TVL |
| `get_protocol` | TVL, 1d/7d change, chains, category for one protocol |
| `get_token_prices` | Current USD price for one or more tokens (DefiLlama coin ids) |
| `get_yield_pools` | Top yield pools by APY, filter by chain / project / min TVL |
| `get_stablecoins` | Largest stablecoins by circulating supply + peg type |

## Install

No install needed. It runs straight from npm via `npx`.

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "defillama": {
      "command": "npx",
      "args": ["-y", "defillama-mcp"]
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "defillama": {
      "command": "npx",
      "args": ["-y", "defillama-mcp"]
    }
  }
}
```

Restart the client and the `defillama` tools appear.

## Coin ids for prices

`get_token_prices` uses DefiLlama coin ids, comma-separated:

- By CoinGecko id: `coingecko:bitcoin`, `coingecko:ethereum`
- By contract: `chain:0xcontract`, e.g. `ethereum:0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` (WETH)

## Develop

```bash
npm install
npm run dev     # run from TypeScript source over stdio
npm test        # run the unit tests
npm run build   # compile to dist/
```

## License

MIT — see [LICENSE](./LICENSE).

---

## Hire me

I build custom MCP servers and AI systems (multi-agent, RAG, automation). Need a connector for your own API, or a full AI integration?

- Hire me on Upwork: https://www.upwork.com/freelancers/~01946645ed245c263d
- Or open an issue on this repo.

Built by Gleb.
