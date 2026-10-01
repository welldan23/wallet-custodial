import {
  getBase58Decoder,
  getBase64Encoder,
  getCompiledTransactionMessageDecoder,
  getTransactionDecoder,
} from '@solana/kit';
import {
  keccak256,
  parseTransaction,
  recoverTransactionAddress,
  type Hex,
  type TransactionSerialized,
} from 'viem';

import { TransactionDecodeError } from '../transactions/types.js';

/** Transaksi EVM yang disiapkan backend; tanda tangan wajib persis sama isinya. */
export type PreparedEvmCall = { to: string; data: string; value: bigint };

/**
 * Pastikan transaksi EVM bertanda tangan = yang disiapkan: chain, tujuan,
 * data, dan nilai sama persis, ditandatangani oleh pengirim yang sama.
 * Biaya gas & nonce boleh diatur HP. Mengembalikan hash transaksi.
 */
export async function verifyPreparedEvm(
  signed: string,
  prepared: PreparedEvmCall,
  expected: { chainId: string; from: string },
): Promise<string> {
  if (!/^0x[0-9a-fA-F]+$/.test(signed)) throw new TransactionDecodeError('invalid_encoding');
  let tx: ReturnType<typeof parseTransaction>;
  let from: string;
  try {
    tx = parseTransaction(signed as TransactionSerialized);
    from = await recoverTransactionAddress({
      serializedTransaction: signed as TransactionSerialized,
    });
  } catch {
    throw new TransactionDecodeError('invalid_encoding');
  }
  if (String(tx.chainId) !== expected.chainId) throw new TransactionDecodeError('wrong_chain');
  if (from.toLowerCase() !== expected.from.toLowerCase())
    throw new TransactionDecodeError('unsigned');
  const same =
    tx.to?.toLowerCase() === prepared.to.toLowerCase() &&
    (tx.data ?? '0x').toLowerCase() === prepared.data.toLowerCase() &&
    (tx.value ?? 0n) === prepared.value;
  if (!same) throw new TransactionDecodeError('unsupported_transaction');
  return keccak256(signed as Hex);
}

const decodeWire = (base64: string) => {
  try {
    return getTransactionDecoder().decode(getBase64Encoder().encode(base64));
  } catch {
    throw new TransactionDecodeError('invalid_encoding');
  }
};

const bytesEqual = (a: ArrayLike<number>, b: ArrayLike<number>) =>
  a.length === b.length && Array.from(a).every((byte, index) => byte === b[index]);

/**
 * Pastikan transaksi Solana bertanda tangan = yang disiapkan: byte pesannya
 * sama persis (hanya tanda tangan yang boleh bertambah) dan pembayar biaya =
 * pengirim, sudah menandatangani. Mengembalikan signature (id transaksi).
 */
export function verifyPreparedSolana(
  signedBase64: string,
  preparedBase64: string,
  expectedFrom: string,
): string {
  const signed = decodeWire(signedBase64);
  const prepared = decodeWire(preparedBase64);
  if (!bytesEqual(signed.messageBytes, prepared.messageBytes)) {
    throw new TransactionDecodeError('unsupported_transaction');
  }
  const message = getCompiledTransactionMessageDecoder().decode(signed.messageBytes);
  const feePayer = String(message.staticAccounts[0] ?? '');
  const sig = signed.signatures[feePayer as keyof typeof signed.signatures];
  if (feePayer !== expectedFrom || !sig) throw new TransactionDecodeError('unsigned');
  return getBase58Decoder().decode(sig);
}

/** Program bawaan yang bukan router agregator. */
const INFRA_PROGRAMS = new Set([
  '11111111111111111111111111111111',
  'ComputeBudget111111111111111111111111111111',
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
]);

/**
 * Program router agregator di transaksi Solana: program terakhir yang bukan
 * program bawaan (system, compute budget, token, ATA). `null` kalau tidak ketemu.
 */
export function solanaRouterProgram(base64: string): string | null {
  const message = getCompiledTransactionMessageDecoder().decode(decodeWire(base64).messageBytes);
  if (!('instructions' in message)) return null;
  const programs = message.instructions.map((instruction) =>
    String(message.staticAccounts[instruction.programAddressIndex] ?? ''),
  );
  return programs.filter((program) => program && !INFRA_PROGRAMS.has(program)).at(-1) ?? null;
}
