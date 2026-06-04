/**
 * Formatting helpers.
 *
 * Turn DefiLlama's verbose JSON into compact, agent-friendly text. Pure (no I/O)
 * so they are trivial to unit-test and keep the tool handlers thin.
 */

/** Compact number: 1234567 -> "1.23M", 1500 -> "1.50K". */
export function fmtNum(n: unknown): string {
  const v = typeof n === "string" ? parseFloat(n) : (n as number);
  if (v == null || Number.isNaN(v)) return "?";
  const abs = Math.abs(v);
  if (abs >= 1e12) return (v / 1e12).toFixed(2) + "T";
  if (abs >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (abs >= 1e3) return (v / 1e3).toFixed(2) + "K";
  if (abs === 0) return "0";
  if (abs >= 1) return v.toFixed(2);
  return v.toPrecision(3);
}

export function fmtUsd(n: unknown): string {
  const s = fmtNum(n);
  return s === "?" ? "?" : `$${s}`;
}

export function fmtPct(n: unknown): string {
  const v = typeof n === "string" ? parseFloat(n) : (n as number);
  if (v == null || Number.isNaN(v)) return "?";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
}

/** Price formatter: keeps precision for sub-dollar tokens. */
export function fmtPrice(n: unknown): string {
  const v = typeof n === "string" ? parseFloat(n) : (n as number);
  if (v == null || Number.isNaN(v)) return "?";
  if (v === 0) return "0";
  if (v >= 1) return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return v.toPrecision(4);
}

/** Sort a list of {tvl} objects by TVL descending and take the top `limit`. */
export function topByTvl(arr: unknown, limit: number): any[] {
  const list = Array.isArray(arr) ? arr : [];
  return list
    .filter((x) => x && typeof x === "object")
    .sort((a: any, b: any) => (Number(b.tvl) || 0) - (Number(a.tvl) || 0))
    .slice(0, limit);
}

export function summarizeChains(data: unknown, limit = 20): string {
  const top = topByTvl(data, limit);
  if (top.length === 0) return "No chains found.";
  return top
    .map((c, i) => `${i + 1}. ${c.name ?? "?"} · TVL ${fmtUsd(c.tvl)}${c.tokenSymbol ? ` · ${c.tokenSymbol}` : ""}`)
    .join("\n");
}

/** Case-insensitive filter on name/symbol/category. Empty query returns all. */
export function filterProtocols(arr: unknown, query: string): any[] {
  const list = Array.isArray(arr) ? arr : [];
  if (!query) return list;
  const q = query.toLowerCase();
  return list.filter((p: any) => {
    const hay = `${p?.name ?? ""} ${p?.symbol ?? ""} ${p?.category ?? ""}`.toLowerCase();
    return hay.includes(q);
  });
}

export function summarizeProtocolLine(p: any): string {
  if (!p || typeof p !== "object") return "";
  const sym = p.symbol && p.symbol !== "-" ? ` (${p.symbol})` : "";
  const cat = p.category ? ` · ${p.category}` : "";
  const chains = Array.isArray(p.chains) && p.chains.length
    ? ` · ${p.chains.slice(0, 3).join(", ")}${p.chains.length > 3 ? "…" : ""}`
    : "";
  return `${p.name ?? "?"}${sym}${cat} · TVL ${fmtUsd(p.tvl)} · 1d ${fmtPct(p.change_1d)} · 7d ${fmtPct(p.change_7d)}${chains}`;
}

export function summarizeProtocols(data: unknown, query = "", limit = 15): string {
  const filtered = filterProtocols(data, query);
  const top = topByTvl(filtered, limit);
  if (top.length === 0) return query ? `No protocols match "${query}".` : "No protocols found.";
  return top.map((p, i) => `${i + 1}. ${summarizeProtocolLine(p)}`).join("\n");
}

export function summarizePrices(data: unknown): string {
  const coins = data && typeof data === "object" ? (data as any).coins : null;
  if (!coins || typeof coins !== "object") return "No prices found.";
  const entries = Object.entries(coins);
  if (entries.length === 0) return "No prices found.";
  return entries
    .map(([k, v]: [string, any]) => {
      const sym = v?.symbol ? ` (${v.symbol})` : "";
      const price = v?.price != null ? `$${fmtPrice(v.price)}` : "?";
      return `${k}${sym} · ${price}`;
    })
    .join("\n");
}

export interface PoolFilter {
  chain?: string;
  project?: string;
  minTvlUsd?: number;
  limit?: number;
}

export function summarizePools(data: unknown, opts: PoolFilter = {}): string {
  const { chain, project, minTvlUsd = 0, limit = 15 } = opts;
  const raw = data && typeof data === "object" && Array.isArray((data as any).data)
    ? (data as any).data
    : Array.isArray(data) ? data : [];
  let pools = raw.filter((p: any) => p && typeof p === "object");
  if (chain) pools = pools.filter((p: any) => String(p.chain ?? "").toLowerCase() === chain.toLowerCase());
  if (project) pools = pools.filter((p: any) => String(p.project ?? "").toLowerCase().includes(project.toLowerCase()));
  if (minTvlUsd) pools = pools.filter((p: any) => (Number(p.tvlUsd) || 0) >= minTvlUsd);
  pools.sort((a: any, b: any) => (Number(b.apy) || 0) - (Number(a.apy) || 0));
  const top = pools.slice(0, limit);
  if (top.length === 0) return "No yield pools match.";
  return top
    .map((p: any, i: number) => `${i + 1}. ${p.symbol ?? "?"} · ${p.project ?? "?"} (${p.chain ?? "?"}) · APY ${fmtPct(p.apy)} · TVL ${fmtUsd(p.tvlUsd)}`)
    .join("\n");
}

/** Stablecoin circulating supply in USD (DefiLlama keys it by pegType). */
export function circulatingUsd(s: any): number {
  const c = s?.circulating;
  if (c && typeof c === "object") {
    const v = c[s?.pegType] ?? Object.values(c).find((x) => typeof x === "number");
    return Number(v) || 0;
  }
  return 0;
}

export function summarizeStablecoins(data: unknown, limit = 15): string {
  const arr = data && typeof data === "object" && Array.isArray((data as any).peggedAssets)
    ? (data as any).peggedAssets
    : [];
  if (arr.length === 0) return "No stablecoins found.";
  return arr
    .map((s: any) => ({ s, circ: circulatingUsd(s) }))
    .sort((a: any, b: any) => b.circ - a.circ)
    .slice(0, limit)
    .map(({ s, circ }: any, i: number) => `${i + 1}. ${s.name ?? "?"} (${s.symbol ?? "?"}) · ${s.pegType ?? "?"} · circ ${fmtUsd(circ)}`)
    .join("\n");
}
