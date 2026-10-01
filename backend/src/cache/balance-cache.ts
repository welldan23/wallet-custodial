import { createHmac } from 'node:crypto';

import type { RawBalance } from '../chains/types.js';

import type { BalanceStore } from './balance-store.js';

export type CachedBalances = {
  balances: RawBalance[];
  fetchedAt: string;
  /**
   * - `cache`: masih segar di SQLite, RPC tidak dipanggil
   * - `rpc`: baru dibaca dari RPC lalu disimpan
   * - `stale`: RPC gagal, memakai data lama yang masih dalam batas
   */
  source: 'cache' | 'rpc' | 'stale';
  /** Error RPC kalau `source` = `stale`. */
  error?: unknown;
};

export type BalanceCacheOptions = {
  store: BalanceStore;
  /** Data lebih muda dari ini dipakai tanpa memanggil RPC. */
  ttlMs: number;
  /** Kalau RPC gagal, data selama masih lebih muda dari ini tetap dipakai. */
  maxStaleMs: number;
  /** Kunci HMAC untuk menyamarkan alamat sebelum disimpan. */
  ownerKeySecret: string;
  now?: () => Date;
};

/**
 * Cache saldo dua lapis: SQLite (bertahan saat server restart) + penggabung
 * permintaan yang sedang berjalan. Alamat pemilik disimpan sebagai HMAC,
 * jadi isi database tidak membocorkan alamat siapa saja yang memakai app.
 */
export class BalanceCache {
  private readonly inFlight = new Map<string, Promise<CachedBalances>>();

  constructor(private readonly options: BalanceCacheOptions) {}

  /** Kunci tersamar untuk alamat (alamat EVM harus sudah dinormalisasi/checksum). */
  ownerKey(owner: string): string {
    return createHmac('sha256', this.options.ownerKeySecret).update(owner).digest('hex');
  }

  async load(
    networkId: string,
    owner: string,
    tokenIds: string[],
    fetchFresh: () => Promise<RawBalance[]>,
  ): Promise<CachedBalances> {
    const ownerKey = this.ownerKey(owner);
    const stored = this.options.store.get(networkId, ownerKey);
    // Kalau katalog menambah token baru, data lama dianggap tidak lengkap.
    const complete =
      stored && tokenIds.every((id) => stored.balances.some((balance) => balance.tokenId === id))
        ? stored
        : null;

    if (complete && this.ageMs(complete.fetchedAt) < this.options.ttlMs) {
      return { ...complete, source: 'cache' };
    }

    const key = `${networkId}:${ownerKey}`;
    let pending = this.inFlight.get(key);
    if (!pending) {
      pending = this.refresh(networkId, ownerKey, complete, fetchFresh).finally(() =>
        this.inFlight.delete(key),
      );
      this.inFlight.set(key, pending);
    }
    return pending;
  }

  private async refresh(
    networkId: string,
    ownerKey: string,
    previous: { balances: RawBalance[]; fetchedAt: string } | null,
    fetchFresh: () => Promise<RawBalance[]>,
  ): Promise<CachedBalances> {
    try {
      const balances = await fetchFresh();
      const fetchedAt = this.now().toISOString();
      this.options.store.set(networkId, ownerKey, balances, fetchedAt);
      return { balances, fetchedAt, source: 'rpc' };
    } catch (error) {
      if (previous && this.ageMs(previous.fetchedAt) < this.options.maxStaleMs) {
        return { ...previous, source: 'stale', error };
      }
      throw error;
    }
  }

  private ageMs(iso: string): number {
    return this.now().getTime() - Date.parse(iso);
  }

  private now(): Date {
    return this.options.now?.() ?? new Date();
  }
}
