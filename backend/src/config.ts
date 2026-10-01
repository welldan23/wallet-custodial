/** RPC publik bawaan. Untuk production, ganti lewat env RPC_URL_<JARINGAN>. */
export const DEFAULT_RPC_URLS: Record<string, string> = {
  ethereum: 'https://ethereum-rpc.publicnode.com',
  arbitrum: 'https://arb1.arbitrum.io/rpc',
  base: 'https://mainnet.base.org',
  polygon: 'https://polygon-bor-rpc.publicnode.com',
  solana: 'https://api.mainnet-beta.solana.com',
};

export type Config = {
  port: number;
  databasePath: string;
  /** URL RPC per id jaringan. */
  rpcUrls: Record<string, string>;
  balanceCacheTtlMs: number;
  /** Kalau RPC gagal, saldo tersimpan selama masih lebih muda dari ini tetap dipakai. */
  balanceMaxStaleMs: number;
  /** Saldo tersimpan lebih tua dari ini dihapus. */
  balanceCacheRetentionMs: number;
  /** Kunci HMAC untuk menyamarkan alamat di cache. `null` = acak per proses. */
  cacheKeySecret: string | null;
  rpcTimeoutMs: number;
  priceRefreshIntervalMs: number;
  fxRefreshIntervalMs: number;
  priceStaleAfterMs: number;
  priceFetchTimeoutMs: number;
  /** API key demo CoinGecko (opsional, untuk sumber cadangan). */
  coingeckoApiKey: string | null;
  /** Agregator swap: LI.FI (EVM & bridge) dan Jupiter (Solana). Key opsional. */
  lifiApiKey: string | null;
  lifiIntegrator: string | null;
  jupiterBaseUrl: string;
  jupiterApiKey: string | null;
  swapQuoteTimeoutMs: number;
};

function toNonNegativeInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const rpcUrls = Object.fromEntries(
    Object.entries(DEFAULT_RPC_URLS).map(([networkId, url]) => [
      networkId,
      env[`RPC_URL_${networkId.toUpperCase()}`] || url,
    ]),
  );

  return {
    port: toNonNegativeInt(env.PORT, 8787),
    databasePath: env.DATABASE_PATH || './data/mywallet.db',
    rpcUrls,
    balanceCacheTtlMs: toNonNegativeInt(env.BALANCE_CACHE_TTL_MS, 20_000),
    balanceMaxStaleMs: toNonNegativeInt(env.BALANCE_MAX_STALE_MS, 24 * 60 * 60_000),
    balanceCacheRetentionMs: toNonNegativeInt(env.BALANCE_CACHE_RETENTION_MS, 7 * 24 * 60 * 60_000),
    cacheKeySecret: env.CACHE_KEY_SECRET || null,
    rpcTimeoutMs: toNonNegativeInt(env.RPC_TIMEOUT_MS, 8_000),
    priceRefreshIntervalMs: toNonNegativeInt(env.PRICE_REFRESH_INTERVAL_MS, 60_000),
    fxRefreshIntervalMs: toNonNegativeInt(env.FX_REFRESH_INTERVAL_MS, 60 * 60_000),
    priceStaleAfterMs: toNonNegativeInt(env.PRICE_STALE_AFTER_MS, 15 * 60_000),
    priceFetchTimeoutMs: toNonNegativeInt(env.PRICE_FETCH_TIMEOUT_MS, 8_000),
    coingeckoApiKey: env.COINGECKO_API_KEY || null,
    lifiApiKey: env.LIFI_API_KEY || null,
    lifiIntegrator: env.LIFI_INTEGRATOR || null,
    jupiterBaseUrl: env.JUPITER_BASE_URL || 'https://lite-api.jup.ag',
    jupiterApiKey: env.JUPITER_API_KEY || null,
    swapQuoteTimeoutMs: toNonNegativeInt(env.SWAP_QUOTE_TIMEOUT_MS, 10_000),
  };
}
