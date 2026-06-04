/**
 * DefiLlama API client.
 *
 * Thin, typed-enough fetch wrapper around DefiLlama's free public REST APIs.
 * DefiLlama splits data across several hosts (TVL, prices, yields, stablecoins);
 * all are free and require NO API key. Endpoint builders are pure functions so
 * they can be unit-tested without network.
 */

export const HOSTS = {
  main: "https://api.llama.fi",
  coins: "https://coins.llama.fi",
  yields: "https://yields.llama.fi",
  stablecoins: "https://stablecoins.llama.fi",
} as const;

export interface LlamaFetchOptions {
  /** Inject a fetch implementation (used in tests). Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Request timeout in milliseconds. Defaults to 20000. */
  timeoutMs?: number;
}

export async function llamaFetch<T = unknown>(
  url: string,
  opts: LlamaFetchOptions = {},
): Promise<T> {
  const fetchImpl = opts.fetchImpl ?? fetch;

  const resp = await fetchImpl(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": "defillama-mcp/1.0 (+https://github.com)",
    },
    signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(
      `DefiLlama API ${resp.status} for ${url}: ${text.slice(0, 300)}`,
    );
  }
  return (await resp.json()) as T;
}

/** Pure URL builders for each free endpoint we use. */
export const endpoints = {
  chains: () => `${HOSTS.main}/v2/chains`,
  protocols: () => `${HOSTS.main}/protocols`,
  prices: (coins: string) => `${HOSTS.coins}/prices/current/${coins}`,
  yieldPools: () => `${HOSTS.yields}/pools`,
  stablecoins: () => `${HOSTS.stablecoins}/stablecoins?includePrices=true`,
} as const;
