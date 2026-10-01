import { randomUUID } from 'node:crypto';

import type { Db } from '../db/database.js';
import type { Transaction, TransactionStatus, TransactionType } from '../types.js';

export type NewTransaction = {
  walletKey: string;
  networkId: string;
  tokenId: string;
  type: TransactionType;
  amountRaw: bigint;
  amountUsd: number | null;
  feeRaw?: bigint | null;
  counterpartyAddress: string;
  txHash: string;
};

const SELECT = `
  SELECT id, wallet_key AS walletKey, network_id AS networkId, token_id AS tokenId, type, status,
         amount_raw AS amountRaw, amount_usd AS amountUsd, fee_raw AS feeRaw,
         counterparty_address AS counterpartyAddress, tx_hash AS txHash,
         created_at AS createdAt, updated_at AS updatedAt
  FROM transactions`;

/** Akses tabel `transactions`. */
export class TransactionStore {
  constructor(
    private readonly db: Db,
    private readonly now: () => Date = () => new Date(),
  ) {}

  findByHash(walletKey: string, networkId: string, txHash: string): Transaction | null {
    return (
      (this.db
        .prepare(`${SELECT} WHERE wallet_key = ? AND network_id = ? AND tx_hash = ?`)
        .get(walletKey, networkId, txHash) as Transaction | undefined) ?? null
    );
  }

  /**
   * Catat transaksi baru berstatus `pending`. Kalau hash yang sama sudah
   * tercatat untuk wallet + jaringan ini, kembalikan yang lama (`created: false`).
   */
  insertPending(input: NewTransaction): { transaction: Transaction; created: boolean } {
    const at = this.now().toISOString();
    const result = this.db
      .prepare(
        `INSERT INTO transactions (id, wallet_key, network_id, token_id, type, status, amount_raw,
           amount_usd, fee_raw, counterparty_address, tx_hash, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (wallet_key, network_id, tx_hash) DO NOTHING`,
      )
      .run(
        randomUUID(),
        input.walletKey,
        input.networkId,
        input.tokenId,
        input.type,
        input.amountRaw.toString(),
        input.amountUsd,
        input.feeRaw?.toString() ?? null,
        input.counterpartyAddress,
        input.txHash,
        at,
        at,
      );
    const transaction = this.findByHash(input.walletKey, input.networkId, input.txHash);
    if (!transaction) throw new Error('transaction_not_saved');
    return { transaction, created: result.changes === 1 };
  }

  setStatus(id: string, status: TransactionStatus, feeRaw?: bigint | null): void {
    this.db
      .prepare(
        `UPDATE transactions SET status = ?, fee_raw = COALESCE(?, fee_raw), updated_at = ?
         WHERE id = ?`,
      )
      .run(status, feeRaw?.toString() ?? null, this.now().toISOString(), id);
  }
}
