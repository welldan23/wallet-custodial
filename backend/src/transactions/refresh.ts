import type { Catalog } from '../catalog/repository.js';
import { withTimeout } from '../lib/timeout.js';
import type { SwapProgressChecker } from '../swap/progress.js';
import type { Transaction } from '../types.js';

import type { TransactionStatusChecker } from './status.js';
import type { TransactionStore } from './store.js';

/** Paling sering cek ke RPC per transaksi pending. */
export const STATUS_RECHECK_MS = 5_000;
/**
 * Solana: transaksi tak terlihat setelah ini dianggap kedaluwarsa (blockhash
 * berlaku ±150 blok ≈ 1–2 menit, diberi cadangan).
 */
export const SOLANA_EXPIRY_MS = 3 * 60_000;
/** EVM: pending lebih lama dari ini ditandai "tertahan" (mungkin fee terlalu rendah). */
export const STUCK_AFTER_MS = 30 * 60_000;

export type RefreshDeps = {
  loadCatalog: () => Catalog;
  transactionStore: TransactionStore;
  statusCheckers?: Map<string, TransactionStatusChecker>;
  swapProgress?: SwapProgressChecker;
  rpcTimeoutMs: number;
  now?: () => Date;
};

export type RefreshResult = {
  transaction: Transaction;
  isStuck: boolean;
  /** `true` = status belum sempat dicek ulang (RPC gagal). */
  checkFailed: boolean;
};

/**
 * Perbarui status transaksi `pending` dari blockchain (dibatasi tiap 5 detik):
 * 1. transaksi asal: receipt EVM / status signature Solana;
 * 2. khusus swap yang asalnya sudah sukses: jumlah diterima, dan untuk swap
 *    beda jaringan status bridge — baru `success` setelah koin sampai.
 */
export class StatusRefresher {
  private readonly lastChecked = new Map<string, number>();

  constructor(private readonly deps: RefreshDeps) {}

  private now() {
    return (this.deps.now?.() ?? new Date()).getTime();
  }

  async refresh(transaction: Transaction): Promise<RefreshResult> {
    const { transactionStore: store } = this.deps;
    const catalog = this.deps.loadCatalog();
    const network = catalog.networks.find((item) => item.id === transaction.networkId);
    const at = this.now();
    const age = at - new Date(transaction.createdAt).getTime();
    let checkFailed = false;
    let current = transaction;

    const checker = this.deps.statusCheckers?.get(transaction.networkId);
    if (
      transaction.status === 'pending' &&
      checker &&
      at - (this.lastChecked.get(transaction.id) ?? 0) >= STATUS_RECHECK_MS
    ) {
      this.lastChecked.set(transaction.id, at);
      try {
        const result = await withTimeout(checker.check(transaction.txHash), this.deps.rpcTimeoutMs);
        if (result?.state === 'failed') {
          store.setStatus(transaction.id, 'failed', result.feeRaw);
        } else if (result?.state === 'success') {
          if (transaction.type === 'swap') {
            store.setStatus(transaction.id, 'pending', result.feeRaw);
            await this.advanceSwap(transaction.id, catalog);
          } else {
            store.setStatus(transaction.id, 'success', result.feeRaw);
          }
        } else if (!result && network?.chainType === 'solana' && age > SOLANA_EXPIRY_MS) {
          store.setStatus(transaction.id, 'failed');
        }
      } catch (error) {
        checkFailed = true;
        console.warn(
          `[status] ${transaction.networkId} gagal: ${error instanceof Error ? error.name : 'unknown'}`,
        );
      }
      current = store.findById(transaction.id) ?? transaction;
    }
    if (current.status !== 'pending') this.lastChecked.delete(current.id);

    return {
      transaction: current,
      isStuck: current.status === 'pending' && network?.chainType === 'evm' && age > STUCK_AFTER_MS,
      checkFailed,
    };
  }

  /** Transaksi asal swap sudah sukses: cek hasil akhir (diterima / bridge). */
  private async advanceSwap(id: string, catalog: Catalog) {
    const { transactionStore: store, swapProgress } = this.deps;
    const swap = store.findSwap(id);
    if (!swap) return;
    const crossChain = swap.swap.toNetworkId !== swap.networkId;
    const fromNetwork = catalog.networks.find((item) => item.id === swap.networkId);
    const toNetwork = catalog.networks.find((item) => item.id === swap.swap.toNetworkId);
    const toToken = catalog.tokens.find((item) => item.id === swap.swap.toTokenId);

    if (!swapProgress || !fromNetwork || !toNetwork || !toToken) {
      // Tanpa pemantau: swap satu jaringan dianggap selesai saat transaksinya sukses.
      if (!crossChain) store.setStatus(id, 'success');
      return;
    }

    let progress;
    try {
      progress = await withTimeout(
        swapProgress.check(swap, { fromNetwork, toNetwork, toToken }),
        this.deps.rpcTimeoutMs,
      );
    } catch (error) {
      // Swap satu jaringan sudah pasti selesai; jumlah diterima boleh menyusul kosong.
      if (!crossChain) store.setStatus(id, 'success');
      throw error;
    }

    store.setSwapResult(id, {
      receivedAmountRaw: progress.receivedAmountRaw,
      bridgeStatus: crossChain ? (progress.bridgeStatus ?? null) : null,
      destinationTxHash: progress.destinationTxHash,
    });
    if (!crossChain) {
      store.setStatus(id, progress.state === 'failed' ? 'failed' : 'success');
    } else if (progress.state !== 'pending') {
      store.setStatus(id, progress.state);
    }
  }
}
