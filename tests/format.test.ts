import { describe, it, expect, vi } from "vitest";
import { llamaFetch, endpoints, HOSTS } from "../src/api";
import {
  fmtNum,
  fmtUsd,
  fmtPct,
  fmtPrice,
  topByTvl,
  filterProtocols,
  summarizeChains,
  summarizeProtocols,
  summarizePrices,
  summarizePools,
  summarizeStablecoins,
  circulatingUsd,
} from "../src/format";

describe("endpoints", () => {
  it("builds the fixed urls", () => {
    expect(endpoints.chains()).toBe(`${HOSTS.main}/v2/chains`);
    expect(endpoints.protocols()).toBe(`${HOSTS.main}/protocols`);
    expect(endpoints.yieldPools()).toBe(`${HOSTS.yields}/pools`);
    expect(endpoints.stablecoins()).toBe(`${HOSTS.stablecoins}/stablecoins?includePrices=true`);
  });
  it("builds a prices url with the coin ids in the path", () => {
    expect(endpoints.prices("coingecko:bitcoin,coingecko:ethereum")).toBe(
      `${HOSTS.coins}/prices/current/coingecko:bitcoin,coingecko:ethereum`,
    );
  });
});

describe("llamaFetch", () => {
  it("returns parsed json from the given url", async () => {
    const fake = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const out = await llamaFetch(endpoints.chains(), { fetchImpl: fake as any });
    expect(out).toEqual({ ok: true });
    expect((fake.mock.calls[0] as any)[0]).toBe(`${HOSTS.main}/v2/chains`);
  });
  it("throws with status on a non-ok response", async () => {
    const fake = vi.fn(async () => new Response("rate limited", { status: 429 }));
    await expect(llamaFetch("https://api.llama.fi/x", { fetchImpl: fake as any })).rejects.toThrow(/429/);
  });
});

describe("number formatting", () => {
  it("formats compact numbers, usd, pct, price", () => {
    expect(fmtNum(1500)).toBe("1.50K");
    expect(fmtNum(2_500_000_000_000)).toBe("2.50T");
    expect(fmtUsd(1234567)).toBe("$1.23M");
    expect(fmtPct(-3.2)).toBe("-3.2%");
    expect(fmtPct(7)).toBe("+7.0%");
    expect(fmtUsd(undefined)).toBe("?");
    expect(fmtPrice(0.0000012)).toBe("0.000001200");
    expect(fmtPrice(1776.04)).toBe("1,776.04");
  });
});

describe("chains + protocols", () => {
  const chains = [
    { name: "Ethereum", tvl: 80e9, tokenSymbol: "ETH" },
    { name: "Solana", tvl: 12e9, tokenSymbol: "SOL" },
    { name: "Harmony", tvl: 245662, tokenSymbol: "ONE" },
  ];
  const protocols = [
    { name: "Lido", symbol: "LDO", category: "Liquid Staking", tvl: 30e9, change_1d: 1.2, change_7d: -3.4, chains: ["Ethereum"] },
    { name: "Aave", symbol: "AAVE", category: "Lending", tvl: 20e9, change_1d: -0.5, change_7d: 2.1, chains: ["Ethereum", "Polygon", "Arbitrum", "Base"] },
    { name: "Uniswap", symbol: "UNI", category: "Dexes", tvl: 5e9, change_1d: 0, change_7d: 0, chains: ["Ethereum"] },
  ];

  it("topByTvl ranks and limits", () => {
    const top = topByTvl(chains, 2);
    expect(top.map((c) => c.name)).toEqual(["Ethereum", "Solana"]);
  });

  it("summarizeChains ranks by TVL and formats", () => {
    const out = summarizeChains(chains, 2);
    expect(out).toContain("1. Ethereum · TVL $80.00B · ETH");
    expect(out).toContain("2. Solana");
    expect(out).not.toContain("Harmony");
  });

  it("filterProtocols matches name/symbol/category case-insensitively", () => {
    expect(filterProtocols(protocols, "lending").map((p) => p.name)).toEqual(["Aave"]);
    expect(filterProtocols(protocols, "uni").map((p) => p.name)).toEqual(["Uniswap"]);
    expect(filterProtocols(protocols, "")).toHaveLength(3);
  });

  it("summarizeProtocols filters then ranks by TVL", () => {
    const out = summarizeProtocols(protocols, "", 2);
    expect(out).toContain("1. Lido (LDO) · Liquid Staking · TVL $30.00B");
    expect(out).toContain("+1.2%");
    const lending = summarizeProtocols(protocols, "lending");
    expect(lending).toContain("Aave");
    expect(lending).not.toContain("Lido");
  });

  it("summarizeProtocols reports no matches cleanly", () => {
    expect(summarizeProtocols(protocols, "nonexistent")).toBe('No protocols match "nonexistent".');
  });
});

describe("prices, pools, stablecoins", () => {
  it("summarizePrices reads the coins map", () => {
    const data = { coins: { "coingecko:ethereum": { price: 1776.04, symbol: "ETH", confidence: 0.99 } } };
    const out = summarizePrices(data);
    expect(out).toContain("coingecko:ethereum (ETH) · $1,776.04");
  });

  it("summarizePools filters by chain and sorts by APY", () => {
    const data = {
      data: [
        { chain: "Ethereum", project: "lido", symbol: "STETH", tvlUsd: 15e9, apy: 2.5 },
        { chain: "Arbitrum", project: "gmx", symbol: "GLP", tvlUsd: 1e8, apy: 30 },
        { chain: "Ethereum", project: "aave", symbol: "USDC", tvlUsd: 2e9, apy: 8.1 },
      ],
    };
    const out = summarizePools(data, { chain: "Ethereum", limit: 5 });
    // Ethereum only, highest APY first
    expect(out.indexOf("USDC")).toBeLessThan(out.indexOf("STETH"));
    expect(out).not.toContain("GLP");
    expect(out).toContain("APY +8.1%");
  });

  it("circulatingUsd reads the pegType-keyed value", () => {
    expect(circulatingUsd({ pegType: "peggedUSD", circulating: { peggedUSD: 187e9 } })).toBe(187e9);
  });

  it("summarizeStablecoins ranks by circulating supply", () => {
    const data = {
      peggedAssets: [
        { name: "USD Coin", symbol: "USDC", pegType: "peggedUSD", circulating: { peggedUSD: 60e9 } },
        { name: "Tether", symbol: "USDT", pegType: "peggedUSD", circulating: { peggedUSD: 187e9 } },
      ],
    };
    const out = summarizeStablecoins(data, 5);
    expect(out.indexOf("Tether")).toBeLessThan(out.indexOf("USD Coin"));
    expect(out).toContain("1. Tether (USDT) · peggedUSD · circ $187.00B");
  });
});
