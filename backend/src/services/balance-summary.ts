import { formatUnits } from 'viem';

import type { Catalog } from '../catalog/repository.js';
import type { BalanceReader, RawBalance } from '../chains/types.js';
import type { TtlCache } from '../lib/ttl-cache.js';
import { TimeoutError, withTimeout } from '../lib/timeout.js';
import type { ChainType, Price } from '../types.js';

export type Owners = Record<ChainType, string | null>;

/**
 * - `ok`: saldo terbaca
 * - `error`: RPC gagal/timeout (saldo jaringan ini tidak ikut dihitung)
 * - `skipped`: alamat untuk tipe jaringan ini tidak dikirim
 * - `unsupported`: belum ada pembaca/RPC untuk jaringan ini
 */
export type NetworkStatus = 'ok' | 'error' | 'skipped' | 'unsupported';

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
  error?: 'rpc_timeout' | 'rpc_error';
};

export type BalanceSummary = {
  owner: Owners;
  totalUsd: number;
  /** Kurs 1 USD → mata uang tampilan. */
  fx: { USD: number; IDR: number | null };
  pricesUpdatedAt: string | null;
  /** `true` kalau ada jaringan yang semestinya dibaca tapi gagal/tidak didukung. */
  isPartial: boolean;
  networks: NetworkSummary[];
  balances: BalanceItem[];
  updatedAt: string;
};

export type BalanceSummaryDeps = {
  loadCatalog: () => Catalog;
  readers: Map<string, BalanceReader>;
  cache: TtlCache<RawBalance[]>;
  rpcTimeoutMs: number;
  now?: () => Date;
  /** Dipanggil saat satu jaringan gagal dibaca (tanpa detail RPC/URL). */
  onNetworkError?: (networkId: string, error: unknown) => void;
};

type NetworkResult = { summary: NetworkSummary; items: BalanceItem[] };

const roundUsd = (value: number) => Math.round(value * 1e6) / 1e6;

function latestPrice(prices: Iterable<Price>): Price | null {
  let latest: Price | null = null;
  for (const price of prices) {
    if (!latest || price.updatedAt > latest.updatedAt) latest = price;
  }
  return latest;
}

/**
 * Ringkasan saldo semua jaringan untuk satu pemilik (alamat EVM + Solana).
 * Tiap jaringan dibaca paralel; jaringan yang gagal tidak menggagalkan
 * jawaban, cukup ditandai `error` dan `isPartial: true`.
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

        if (!ownerAddress) {
          return { summary: { networkId: network.id, status: 'skipped', totalUsd: 0 }, items: [] };
        }
        if (!reader) {
          return {
            summary: { networkId: network.id, status: 'unsupported', totalUsd: 0 },
            items: [],
          };
        }

        try {
          const raws = await deps.cache.getOrLoad(`${network.id}:${ownerAddress}`, () =>
            withTimeout(reader.read(ownerAddress, networkTokens), deps.rpcTimeoutMs),
          );
          const rawByTokenId = new Map(raws.map((balance) => [balance.tokenId, balance.raw]));

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

          const totalUsd = roundUsd(items.reduce((sum, item) => sum + item.valueUsd, 0));
          return { summary: { networkId: network.id, status: 'ok', totalUsd }, items };
        } catch (error) {
          deps.onNetworkError?.(network.id, error);
          return {
            summary: {
              networkId: network.id,
              status: 'error',
              totalUsd: 0,
              error: error instanceof TimeoutError ? 'rpc_timeout' : 'rpc_error',
            },
            items: [],
          };
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
    networks: networkSummaries,
    balances,
    updatedAt: (deps.now?.() ?? new Date()).toISOString(),
  };
}
