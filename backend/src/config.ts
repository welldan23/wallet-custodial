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
  rpcTimeoutMs: number;
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
    rpcTimeoutMs: toNonNegativeInt(env.RPC_TIMEOUT_MS, 8_000),
  };
}
