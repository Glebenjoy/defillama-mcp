#!/usr/bin/env node
/**
 * DefiLlama MCP server.
 *
 * Exposes DefiLlama's free DeFi data (chain/protocol TVL, token prices, yield
 * pools, stablecoins) as MCP tools so any MCP client (Claude Desktop, Cursor,
 * agents) can query the DeFi ecosystem. No API key required.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { llamaFetch, endpoints } from "./api.js";
import {
  summarizeChains,
  summarizeProtocols,
  summarizeProtocolLine,
  filterProtocols,
  topByTvl,
  summarizePrices,
  summarizePools,
  summarizeStablecoins,
} from "./format.js";

const server = new McpServer({ name: "defillama", version: "1.0.0" });

function ok(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function fail(e: unknown) {
  return {
    content: [
      { type: "text" as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` },
    ],
    isError: true,
  };
}

server.tool(
  "get_chains_tvl",
  "Total Value Locked (TVL) across all blockchains, ranked highest first. Shows which chains hold the most DeFi capital.",
  { limit: z.coerce.number().int().positive().max(100).optional().describe("How many chains to return (default 20)") },
  async ({ limit }) => {
    try {
      return ok(summarizeChains(await llamaFetch(endpoints.chains()), limit ?? 20));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "search_protocols",
  "Search DeFi protocols by name, token symbol, or category (e.g. 'lending', 'dexes', 'aave'), ranked by TVL. Leave query empty for the top protocols overall.",
  {
    query: z.string().optional().describe("Name, symbol, or category to match; empty = top protocols"),
    limit: z.coerce.number().int().positive().max(50).optional().describe("How many to return (default 15)"),
  },
  async ({ query, limit }) => {
    try {
      return ok(summarizeProtocols(await llamaFetch(endpoints.protocols()), query ?? "", limit ?? 15));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "get_protocol",
  "Get current TVL, 1d/7d change, chains, and category for a single DeFi protocol by name (e.g. 'Aave', 'Uniswap', 'Lido').",
  { name: z.string().describe("Protocol name to look up") },
  async ({ name }) => {
    try {
      const arr = await llamaFetch(endpoints.protocols());
      const matches = topByTvl(filterProtocols(arr, name), 1);
      if (matches.length === 0) return ok(`No protocol matches "${name}".`);
      const p = matches[0];
      const desc = (p.description ?? "").toString().replace(/\s+/g, " ").slice(0, 200);
      return ok(`${summarizeProtocolLine(p)}${p.url ? `\n${p.url}` : ""}${desc ? `\n${desc}` : ""}`);
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "get_token_prices",
  "Current USD price for one or more tokens. Use DefiLlama coin ids, comma-separated: 'coingecko:bitcoin,coingecko:ethereum' or 'chain:0xcontract' (e.g. 'ethereum:0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2').",
  { tokens: z.string().describe("Comma-separated DefiLlama coin ids") },
  async ({ tokens }) => {
    try {
      const clean = tokens.replace(/\s+/g, "");
      return ok(summarizePrices(await llamaFetch(endpoints.prices(clean))));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "get_yield_pools",
  "Top DeFi yield / farming pools by APY. Optionally filter by chain (e.g. 'Ethereum'), project (e.g. 'aave'), and minimum TVL in USD to avoid tiny risky pools.",
  {
    chain: z.string().optional().describe("Chain name filter, e.g. 'Ethereum', 'Arbitrum'"),
    project: z.string().optional().describe("Project name filter, e.g. 'aave', 'lido'"),
    minTvlUsd: z.coerce.number().nonnegative().optional().describe("Minimum pool TVL in USD"),
    limit: z.coerce.number().int().positive().max(50).optional().describe("How many to return (default 15)"),
  },
  async ({ chain, project, minTvlUsd, limit }) => {
    try {
      return ok(
        summarizePools(await llamaFetch(endpoints.yieldPools()), {
          chain,
          project,
          minTvlUsd: minTvlUsd ?? 0,
          limit: limit ?? 15,
        }),
      );
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "get_stablecoins",
  "Largest stablecoins by circulating supply, with peg type (fiat-backed, crypto-backed, algorithmic).",
  { limit: z.coerce.number().int().positive().max(50).optional().describe("How many to return (default 15)") },
  async ({ limit }) => {
    try {
      return ok(summarizeStablecoins(await llamaFetch(endpoints.stablecoins()), limit ?? 15));
    } catch (e) {
      return fail(e);
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("defillama-mcp running on stdio");
