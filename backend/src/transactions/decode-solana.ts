import {
  getBase58Decoder,
  getBase64Encoder,
  getCompiledTransactionMessageDecoder,
  getTransactionDecoder,
} from '@solana/kit';

import { SPL_TOKEN_PROGRAM_ADDRESS } from '../chains/solana.js';
import type { Token } from '../types.js';

import { TransactionDecodeError, type DecodedTransfer } from './types.js';

const SYSTEM_PROGRAM = '11111111111111111111111111111111';
const COMPUTE_BUDGET_PROGRAM = 'ComputeBudget111111111111111111111111111111';
const ASSOCIATED_TOKEN_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';

/** Nomor instruksi: System `Transfer` = 2, SPL Token `TransferChecked` = 12. */
const SYSTEM_TRANSFER = 2;
const TOKEN_TRANSFER_CHECKED = 12;

/** Cari pemilik akun token (ATA) penerima; `null` kalau tidak diketahui. */
export type TokenAccountOwnerResolver = (tokenAccount: string) => Promise<string | null>;

type Bytes = { buffer: ArrayBufferLike; byteOffset: number; byteLength: number };

const readU64 = (data: Bytes, offset: number) =>
  new DataView(data.buffer, data.byteOffset, data.byteLength).getBigUint64(offset, true);
const readU32 = (data: Bytes, offset: number) =>
  new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(offset, true);

/**
 * Baca kiriman dari transaksi Solana bertanda tangan (wire base64). Yang
 * diterima: tepat satu transfer SOL (System) atau SPL `TransferChecked` untuk
 * mint di katalog, boleh ditemani instruksi compute budget dan pembuatan ATA
 * penerima. Instruksi lain dan address lookup table ditolak.
 */
export async function decodeSolanaTransfer(
  wireBase64: string,
  tokens: Token[],
  resolveTokenAccountOwner: TokenAccountOwnerResolver,
): Promise<DecodedTransfer> {
  let message: ReturnType<ReturnType<typeof getCompiledTransactionMessageDecoder>['decode']>;
  let signatures: ReturnType<ReturnType<typeof getTransactionDecoder>['decode']>['signatures'];
  try {
    const tx = getTransactionDecoder().decode(getBase64Encoder().encode(wireBase64));
    signatures = tx.signatures;
    message = getCompiledTransactionMessageDecoder().decode(tx.messageBytes);
  } catch {
    throw new TransactionDecodeError('invalid_encoding');
  }
  if (message.version !== 'legacy' && message.version !== 0) {
    throw new TransactionDecodeError('unsupported_transaction');
  }
  if ('addressTableLookups' in message && (message.addressTableLookups?.length ?? 0) > 0) {
    throw new TransactionDecodeError('unsupported_transaction');
  }

  const accounts = message.staticAccounts.map(String);
  const feePayer = accounts[0];
  const feePayerSignature = feePayer ? signatures[feePayer as keyof typeof signatures] : null;
  if (!feePayer || !feePayerSignature) throw new TransactionDecodeError('unsigned');
  const txHash = getBase58Decoder().decode(feePayerSignature);
  const signerCount = message.header.numSignerAccounts;
  const isSigner = (account: string) => accounts.indexOf(account) < signerCount;

  const solanaTokens = tokens.filter((token) => token.networkId === 'solana');
  const ataOwners = new Map<string, string>();
  const transfers: Omit<DecodedTransfer, 'txHash'>[] = [];
  let pendingTokenAccount: string | null = null;

  for (const instruction of message.instructions) {
    const program = accounts[instruction.programAddressIndex];
    const keys = (instruction.accountIndices ?? []).map((index) => accounts[index]!);
    const data = instruction.data ?? new Uint8Array();

    if (program === COMPUTE_BUDGET_PROGRAM) continue;

    if (program === ASSOCIATED_TOKEN_PROGRAM) {
      // Create / CreateIdempotent: [payer, ata, owner, mint, system, token]
      if (data.length > 1 || (data.length === 1 && data[0]! > 1) || keys.length < 4) {
        throw new TransactionDecodeError('unsupported_transaction');
      }
      ataOwners.set(keys[1]!, keys[2]!);
      continue;
    }

    if (program === SYSTEM_PROGRAM) {
      if (data.length !== 12 || readU32(data, 0) !== SYSTEM_TRANSFER || keys.length < 2) {
        throw new TransactionDecodeError('unsupported_transaction');
      }
      const native = solanaTokens.find((token) => token.contractAddress === null);
      if (!native) throw new TransactionDecodeError('unsupported_token');
      transfers.push({
        from: keys[0]!,
        counterparty: keys[1]!,
        tokenId: native.id,
        amountRaw: readU64(data, 4),
      });
      continue;
    }

    if (program === SPL_TOKEN_PROGRAM_ADDRESS) {
      if (data.length !== 10 || data[0] !== TOKEN_TRANSFER_CHECKED || keys.length < 4) {
        throw new TransactionDecodeError('unsupported_transaction');
      }
      // TransferChecked: [source, mint, destination, owner]
      const [, mint, destination, owner] = keys as [string, string, string, string];
      const token = solanaTokens.find((item) => item.contractAddress === mint);
      if (!token) throw new TransactionDecodeError('unsupported_token');
      if (data[9] !== token.decimals) throw new TransactionDecodeError('unsupported_transaction');
      pendingTokenAccount = destination;
      transfers.push({
        from: owner,
        counterparty: destination,
        tokenId: token.id,
        amountRaw: readU64(data, 1),
      });
      continue;
    }

    throw new TransactionDecodeError('unsupported_transaction');
  }

  if (transfers.length !== 1) throw new TransactionDecodeError('unsupported_transaction');
  const transfer = transfers[0]!;
  if (transfer.amountRaw <= 0n) throw new TransactionDecodeError('invalid_amount');
  if (!isSigner(transfer.from)) throw new TransactionDecodeError('unsigned');

  if (pendingTokenAccount) {
    // Riwayat menyimpan wallet penerima, bukan akun tokennya.
    transfer.counterparty =
      ataOwners.get(pendingTokenAccount) ??
      (await resolveTokenAccountOwner(pendingTokenAccount)) ??
      pendingTokenAccount;
  }
  return { ...transfer, txHash };
}

/** Signature pertama (pembayar biaya) = id transaksi Solana. */
export function solanaSignatureOf(wireBase64: string): string {
  const tx = getTransactionDecoder().decode(getBase64Encoder().encode(wireBase64));
  const first = Object.values(tx.signatures)[0];
  if (!first) throw new TransactionDecodeError('unsigned');
  return getBase58Decoder().decode(first);
}
