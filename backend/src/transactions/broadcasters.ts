import { createSolanaRpc, type Base64EncodedWireTransaction } from '@solana/kit';
import { createPublicClient, http, type Chain, type Hex } from 'viem';

import { VIEM_CHAINS } from '../chains/evm.js';
import type { Network } from '../types.js';

import {
  BroadcastRejectedError,
  type BroadcastErrorCode,
  type TransactionBroadcaster,
} from './types.js';

/** Pesan RPC yang berarti transaksi sudah pernah diterima (aman dianggap berhasil). */
const ALREADY_KNOWN = /already known|already imported|alreadyprocessed|already been processed/i;

/** Ubah pesan penolakan RPC ke kode yang aman ditampilkan; `null` = bukan penolakan. */
export function rejectionCode(message: string): BroadcastErrorCode | null {
  if (
    /insufficient (funds|lamports)|insufficientfunds|no record of a prior credit/i.test(message)
  ) {
    return 'insufficient_funds';
  }
  if (/nonce too low/i.test(message)) return 'nonce_too_low';
  if (/underpriced|fee too low|max fee per gas less than block base fee/i.test(message)) {
    return 'fee_too_low';
  }
  if (/blockhash not found|blockhashnotfound/i.test(message)) return 'blockhash_expired';
  if (
    /execution reverted|simulation failed|transaction simulation|invalid sender|custom program error/i.test(
      message,
    )
  ) {
    return 'rejected';
  }
  return null;
}

const toJson = (value: unknown) =>
  JSON.stringify(value ?? '', (_key, item) => (typeof item === 'bigint' ? item.toString() : item));

/**
 * Gabungkan pesan error + `details`/`context` + rantai `cause`. Alasan asli
 * penolakan RPC sering ada di dalam `cause` (mis. Solana: simulasi gagal →
 * "no record of a prior credit").
 */
export function errorText(error: unknown, depth = 0): string {
  if (!(error instanceof Error) || depth > 4) return '';
  const extra = error as Error & { details?: unknown; context?: unknown };
  return [
    error.message,
    typeof extra.details === 'string' ? extra.details : '',
    extra.context ? toJson(extra.context) : '',
    errorText(error.cause, depth + 1),
  ].join(' ');
}

/** Terapkan aturan bersama: "sudah diterima" = berhasil, penolakan = kode, sisanya dilempar ulang. */
async function sendWithRules(send: () => Promise<string>, idOf: () => string): Promise<string> {
  try {
    return await send();
  } catch (error) {
    const message = errorText(error);
    if (ALREADY_KNOWN.test(message)) return idOf();
    const code = rejectionCode(message);
    if (code) throw new BroadcastRejectedError(code);
    throw error; // RPC tidak bisa dihubungi / error lain → 502
  }
}

/** Kirim transaksi EVM bertanda tangan (`eth_sendRawTransaction`). */
export function evmBroadcasterFromClient(
  client: { sendRawTransaction(args: { serializedTransaction: Hex }): Promise<Hex> },
  hashOf: (serialized: string) => string,
): TransactionBroadcaster {
  return {
    send: (serialized) =>
      sendWithRules(
        () => client.sendRawTransaction({ serializedTransaction: serialized as Hex }),
        () => hashOf(serialized),
      ),
  };
}

export function createEvmBroadcaster(
  chain: Chain,
  rpcUrl: string,
  hashOf: (serialized: string) => string,
): TransactionBroadcaster {
  return evmBroadcasterFromClient(
    createPublicClient({ chain, transport: http(rpcUrl, { retryCount: 0 }) }),
    hashOf,
  );
}

/** Kirim transaksi Solana (wire base64) dengan preflight supaya error ketahuan sebelum masuk. */
export function solanaBroadcasterFromRpc(
  sendTransaction: (wire: string) => Promise<string>,
  signatureOf: (wire: string) => string,
): TransactionBroadcaster {
  return {
    send: (wire) =>
      sendWithRules(
        () => sendTransaction(wire),
        () => signatureOf(wire),
      ),
  };
}

export function createSolanaBroadcaster(
  rpcUrl: string,
  signatureOf: (wire: string) => string,
): TransactionBroadcaster {
  const rpc = createSolanaRpc(rpcUrl);
  return solanaBroadcasterFromRpc(
    async (wire) =>
      String(
        await rpc
          .sendTransaction(wire as Base64EncodedWireTransaction, {
            encoding: 'base64',
            preflightCommitment: 'confirmed',
          })
          .send(),
      ),
    signatureOf,
  );
}

/** Siapkan broadcaster untuk tiap jaringan yang punya URL RPC. */
export function createBroadcasters(
  networks: Network[],
  rpcUrls: Record<string, string>,
  hashers: { evm: (serialized: string) => string; solana: (wire: string) => string },
): Map<string, TransactionBroadcaster> {
  const broadcasters = new Map<string, TransactionBroadcaster>();
  for (const network of networks) {
    const rpcUrl = rpcUrls[network.id];
    if (!rpcUrl) continue;
    if (network.chainType === 'solana') {
      broadcasters.set(network.id, createSolanaBroadcaster(rpcUrl, hashers.solana));
      continue;
    }
    const chain = VIEM_CHAINS[network.id];
    if (chain) broadcasters.set(network.id, createEvmBroadcaster(chain, rpcUrl, hashers.evm));
  }
  return broadcasters;
}
