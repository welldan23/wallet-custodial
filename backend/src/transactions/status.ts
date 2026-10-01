import { createSolanaRpc, signature } from '@solana/kit';
import { createPublicClient, http, type Chain, type Hex } from 'viem';

import { VIEM_CHAINS } from '../chains/evm.js';
import type { Network } from '../types.js';

/** Hasil cek satu transaksi di jaringan; `null` = belum terlihat sama sekali. */
export type ChainTxStatus = {
  state: 'pending' | 'success' | 'failed';
  /** Biaya yang benar-benar terpakai (satuan terkecil koin gas), kalau sudah diketahui. */
  feeRaw?: bigint;
} | null;

export interface TransactionStatusChecker {
  check(txHash: string): Promise<ChainTxStatus>;
}

type EvmReceipt = {
  status: 'success' | 'reverted';
  gasUsed: bigint;
  effectiveGasPrice: bigint;
  /** OP-stack (Base): biaya data L1. */
  l1Fee?: bigint | null;
};

/** EVM: receipt ada → selesai (sukses/revert) dengan biaya asli; tidak ada → belum masuk blok. */
export function evmStatusCheckerFromClient(client: {
  getTransactionReceipt(args: { hash: Hex }): Promise<EvmReceipt>;
}): TransactionStatusChecker {
  return {
    async check(txHash) {
      let receipt: EvmReceipt;
      try {
        receipt = await client.getTransactionReceipt({ hash: txHash as Hex });
      } catch (error) {
        if (error instanceof Error && error.name === 'TransactionReceiptNotFoundError') return null;
        throw error;
      }
      return {
        state: receipt.status === 'success' ? 'success' : 'failed',
        feeRaw: receipt.gasUsed * receipt.effectiveGasPrice + (receipt.l1Fee ?? 0n),
      };
    },
  };
}

export type SolanaStatusRpc = {
  /** `null` = signature tidak dikenal (belum/tidak pernah masuk). */
  signatureStatus(
    sig: string,
  ): Promise<{ confirmationStatus: string | null; failed: boolean } | null>;
  /** Biaya transaksi (lamport) dari `meta.fee`; `null` kalau belum tersedia. */
  transactionFee(sig: string): Promise<bigint | null>;
};

/** Solana: `confirmed`/`finalized` dianggap selesai; error eksekusi = gagal. */
export function solanaStatusCheckerFromRpc(rpc: SolanaStatusRpc): TransactionStatusChecker {
  return {
    async check(txHash) {
      const status = await rpc.signatureStatus(txHash);
      if (!status) return null;
      const done =
        status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized';
      if (!done && !status.failed) return { state: 'pending' };
      const feeRaw = (await rpc.transactionFee(txHash).catch(() => null)) ?? undefined;
      return { state: status.failed ? 'failed' : 'success', feeRaw };
    },
  };
}

export function createSolanaStatusChecker(rpcUrl: string): TransactionStatusChecker {
  const rpc = createSolanaRpc(rpcUrl);
  return solanaStatusCheckerFromRpc({
    async signatureStatus(sig) {
      const { value } = await rpc
        .getSignatureStatuses([signature(sig)], { searchTransactionHistory: true })
        .send();
      const status = value[0];
      if (!status) return null;
      return { confirmationStatus: status.confirmationStatus ?? null, failed: status.err !== null };
    },
    async transactionFee(sig) {
      const tx = await rpc
        .getTransaction(signature(sig), {
          encoding: 'json',
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0,
        })
        .send();
      return tx?.meta ? BigInt(tx.meta.fee) : null;
    },
  });
}

/** Siapkan pengecek status untuk tiap jaringan yang punya URL RPC. */
export function createStatusCheckers(
  networks: Network[],
  rpcUrls: Record<string, string>,
): Map<string, TransactionStatusChecker> {
  const checkers = new Map<string, TransactionStatusChecker>();
  for (const network of networks) {
    const rpcUrl = rpcUrls[network.id];
    if (!rpcUrl) continue;
    if (network.chainType === 'solana') {
      checkers.set(network.id, createSolanaStatusChecker(rpcUrl));
      continue;
    }
    const chain: Chain | undefined = VIEM_CHAINS[network.id];
    if (chain) {
      const client = createPublicClient({ chain, transport: http(rpcUrl, { retryCount: 1 }) });
      checkers.set(
        network.id,
        evmStatusCheckerFromClient(
          client as unknown as { getTransactionReceipt(args: { hash: Hex }): Promise<EvmReceipt> },
        ),
      );
    }
  }
  return checkers;
}
