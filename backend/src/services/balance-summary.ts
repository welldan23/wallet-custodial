import { formatUnits } from 'viem';

import type { BalanceCache } from '../cache/balance-cache.js';
import type { Catalog } from '../catalog/repository.js';
import type { BalanceReader } from '../chains/types.js';
import { TimeoutError, withTimeout } from '../lib/timeout.js';
import { latestPrice } from '../prices/latest.js';
import type { ChainType } from '../types.js';

export type Owners = Record<ChainType, string | null>;

/**
 * - `ok`: saldo terbaca (dari RPC atau cache yang masih segar)
 * - `stale`: RPC gagal, memakai saldo terakhir yang tersimpan (lihat `fetchedAt`)
 * - `error`: RPC gagal dan tidak ada saldo tersimpan (tidak ikut dihitung)
 * - `skipped`: alamat untuk tipe jaringan ini tidak dikirim
 * - `unsupported`: belum ada pembaca/RPC untuk jaringan ini
 */
export type NetworkStatus = 'ok' | 'stale' | 'error' | 'skipped' | 'unsupported';

export type RpcErrorCode = 'rpc_timeout' | 'rpc_error';

export type BalanceItem = {
  tokenId: string;
  networkId: string;
  symbol: string;
  name: string;
  decimals: number;
  isStablecoin: boolean;
  /** `true` untuk koin gas bawaan jaringan (ETH/POL/SOL). */
  isNative: boolean;
  /** Saldo dalam satuan terkecil (wei/lamport), sebagai string. */
  raw: string;
  /** Saldo dalam satuan token, sebagai string desimal presisi penuh. */
  amount: string;
  usdPrice: number | null;
  valueUsd: number;
};

export type NetworkSummary = {
  networkId: string;
  status: NetworkStatus;
  totalUsd: number;
  /** Kapan saldo jaringan ini dibaca dari blockchain (ISO), `null` kalau tidak ada. */
  fetchedAt: string | null;
  /** Penyebab gagal untuk status `error` atau `stale`. */
  error?: RpcErrorCode;
};

export type BalanceSummary = {
  owner: Owners;
  totalUsd: number;
  /** Kurs 1 USD → mata uang tampilan. */
  fx: { USD: number; IDR: number | null };
  pricesUpdatedAt: string | null;
  /** `true` kalau ada jaringan yang semestinya dibaca tapi gagal/tidak didukung. */
  isPartial: boolean;
  /** `true` kalau ada jaringan yang memakai saldo lama karena RPC gagal. */
  isStale: boolean;
  networks: NetworkSummary[];
  balances: BalanceItem[];
  updatedAt: string;
};

export type BalanceSummaryDeps = {
  loadCatalog: () => Catalog;
  readers: Map<string, BalanceReader>;
  balanceCache: BalanceCache;
  rpcTimeoutMs: number;
  now?: () => Date;
  /** Dipanggil saat satu jaringan gagal dibaca (tanpa detail RPC/URL). */
  onNetworkError?: (networkId: string, error: unknown) => void;
};

type NetworkResult = { summary: NetworkSummary; items: BalanceItem[] };

const roundUsd = (value: number) => Math.round(value * 1e6) / 1e6;

const toErrorCode = (error: unknown): RpcErrorCode =>
  error instanceof TimeoutError ? 'rpc_timeout' : 'rpc_error';

/**
 * Ringkasan saldo semua jaringan untuk satu pemilik (alamat EVM + Solana).
 * Tiap jaringan dibaca paralel lewat cache SQLite. Kalau RPC gagal, saldo
 * terakhir yang tersimpan dipakai (`stale`); kalau tidak ada, jaringan itu
 * ditandai `error` dan `isPartial: true` — jawaban tetap dikirim.
 */
export async function getBalanceSummary(
  deps: BalanceSummaryDeps,
  owner: Owners,
): Promise<BalanceSummary> {
  const { networks, tokens, pricesBySymbol } = deps.loadCatalog();
  const visibleTokens = tokens.filter((token) => token.isVisible);

  const perNetwork = await Promise.all(
    networks
      .filter((network) => network.isActive)
      .map(async (network): Promise<NetworkResult> => {
        const ownerAddress = owner[network.chainType];
        const reader = deps.readers.get(network.id);
        const networkTokens = visibleTokens.filter((token) => token.networkId === network.id);

        const empty = { networkId: network.id, totalUsd: 0, fetchedAt: null };
        if (!ownerAddress) {
          return { summary: { ...empty, status: 'skipped' }, items: [] };
        }
        if (!reader) {
          return { summary: { ...empty, status: 'unsupported' }, items: [] };
        }

        try {
          const cached = await deps.balanceCache.load(
            network.id,
            ownerAddress,
            networkTokens.map((token) => token.id),
            () => withTimeout(reader.read(ownerAddress, networkTokens), deps.rpcTimeoutMs),
          );
          if (cached.source === 'stale') deps.onNetworkError?.(network.id, cached.error);
          const rawByTokenId = new Map(
            cached.balances.map((balance) => [balance.tokenId, balance.raw]),
          );

          const items = networkTokens.map((token): BalanceItem => {
            const raw = rawByTokenId.get(token.id) ?? 0n;
            const amount = formatUnits(raw, token.decimals);
            const usdPrice = pricesBySymbol.get(token.symbol)?.usdPrice ?? null;
            return {
              tokenId: token.id,
              networkId: network.id,
              symbol: token.symbol,
              name: token.name,
              decimals: token.decimals,
              isStablecoin: token.isStablecoin,
              isNative: token.contractAddress === null,
              raw: raw.toString(),
              amount,
              usdPrice,
              valueUsd: usdPrice === null ? 0 : roundUsd(Number(amount) * usdPrice),
            };
          });

          const summary: NetworkSummary = {
            networkId: network.id,
            status: cached.source === 'stale' ? 'stale' : 'ok',
            totalUsd: roundUsd(items.reduce((sum, item) => sum + item.valueUsd, 0)),
            fetchedAt: cached.fetchedAt,
          };
          if (cached.source === 'stale') summary.error = toErrorCode(cached.error);
          return { summary, items };
        } catch (error) {
          deps.onNetworkError?.(network.id, error);
          return { summary: { ...empty, status: 'error', error: toErrorCode(error) }, items: [] };
        }
      }),
  );

  const networkSummaries = perNetwork.map((entry) => entry.summary);
  const balances = perNetwork.flatMap((entry) => entry.items);
  const fxSource = latestPrice(pricesBySymbol.values());

  return {
    owner,
    totalUsd: roundUsd(balances.reduce((sum, item) => sum + item.valueUsd, 0)),
    fx: { USD: 1, IDR: fxSource?.idrRate ?? null },
    pricesUpdatedAt: fxSource?.updatedAt ?? null,
    isPartial: networkSummaries.some(
      (network) => network.status === 'error' || network.status === 'unsupported',
    ),
    isStale: networkSummaries.some((network) => network.status === 'stale'),
    networks: networkSummaries,
    balances,
    updatedAt: (deps.now?.() ?? new Date()).toISOString(),
  };
}
