import { randomUUID } from 'node:crypto';

import type { Db } from '../db/database.js';
import type {
  BridgeStatus,
  SwapDetails,
  SwapProvider,
  SwapTransaction,
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../types.js';

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

export type SentCounterparty = {
  address: string;
  timesUsed: number;
  lastUsedAt: string;
  networkIds: string[];
};

export type NewSwap = Omit<NewTransaction, 'type'> & {
  provider: SwapProvider;
  toNetworkId: string;
  toTokenId: string;
  quotedAmountRaw: bigint;
  minAmountRaw: bigint;
  slippageBps: number;
  quoteId?: string | null;
};

const SWAP_SELECT = `
  SELECT transaction_id AS transactionId, provider, to_network_id AS toNetworkId,
         to_token_id AS toTokenId, quoted_amount_raw AS quotedAmountRaw,
         min_amount_raw AS minAmountRaw, received_amount_raw AS receivedAmountRaw,
         slippage_bps AS slippageBps, bridge_status AS bridgeStatus,
         destination_tx_hash AS destinationTxHash, quote_id AS quoteId
  FROM swap_details`;

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

  findById(id: string): Transaction | null {
    return (this.db.prepare(`${SELECT} WHERE id = ?`).get(id) as Transaction | undefined) ?? null;
  }

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

  /**
   * Alamat yang pernah dikirimi wallet ini di jaringan-jaringan tertentu
   * (kiriman yang tidak gagal), dengan jumlah pemakaian dan waktu terakhir.
   */
  listSentCounterparties(walletKey: string, networkIds: string[]): SentCounterparty[] {
    if (networkIds.length === 0) return [];
    const rows = this.db
      .prepare(
        `SELECT counterparty_address AS address, COUNT(*) AS timesUsed,
                MAX(created_at) AS lastUsedAt, GROUP_CONCAT(DISTINCT network_id) AS networks
         FROM transactions
         WHERE wallet_key = ? AND type = 'send' AND status != 'failed'
           AND network_id IN (${networkIds.map(() => '?').join(', ')})
         GROUP BY counterparty_address
         ORDER BY lastUsedAt DESC`,
      )
      .all(walletKey, ...networkIds) as (Omit<SentCounterparty, 'networkIds'> & {
      networks: string;
    })[];
    return rows.map(({ networks, ...row }) => ({ ...row, networkIds: networks.split(',').sort() }));
  }

  /**
   * Catat swap baru (`pending`): satu baris `transactions` bertipe `swap` +
   * `swap_details`, dalam satu transaksi database. Hash yang sama untuk
   * wallet + jaringan ini mengembalikan swap yang lama.
   */
  insertSwapPending(input: NewSwap): { transaction: SwapTransaction; created: boolean } {
    if (input.minAmountRaw > input.quotedAmountRaw) throw new Error('min_amount_above_quote');
    if (input.minAmountRaw < 0n || input.quotedAmountRaw <= 0n)
      throw new Error('invalid_swap_amount');
    const crossChain = input.toNetworkId !== input.networkId;

    return this.db.transaction(() => {
      const { transaction, created } = this.insertPending({ ...input, type: 'swap' });
      if (created) {
        this.db
          .prepare(
            `INSERT INTO swap_details (transaction_id, provider, to_network_id, to_token_id,
               quoted_amount_raw, min_amount_raw, slippage_bps, bridge_status, quote_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            transaction.id,
            input.provider,
            input.toNetworkId,
            input.toTokenId,
            input.quotedAmountRaw.toString(),
            input.minAmountRaw.toString(),
            input.slippageBps,
            crossChain ? 'pending' : null,
            input.quoteId ?? null,
          );
      }
      const swap = this.findSwap(transaction.id);
      if (!swap) throw new Error('not_a_swap');
      return { transaction: swap, created };
    })();
  }

  /** Transaksi swap + detailnya; `null` kalau tidak ada atau bukan swap. */
  findSwap(transactionId: string): SwapTransaction | null {
    const transaction = this.findById(transactionId);
    const swap = this.db.prepare(`${SWAP_SELECT} WHERE transaction_id = ?`).get(transactionId) as
      SwapDetails | undefined;
    return transaction && swap ? { ...transaction, swap } : null;
  }

  /** Catat hasil akhir swap: jumlah diterima dan (kalau bridge) status + hash tujuan. */
  setSwapResult(
    transactionId: string,
    result: {
      receivedAmountRaw?: bigint | null;
      bridgeStatus?: BridgeStatus | null;
      destinationTxHash?: string | null;
    },
  ): void {
    this.db
      .prepare(
        `UPDATE swap_details SET
           received_amount_raw = COALESCE(?, received_amount_raw),
           bridge_status = COALESCE(?, bridge_status),
           destination_tx_hash = COALESCE(?, destination_tx_hash)
         WHERE transaction_id = ?`,
      )
      .run(
        result.receivedAmountRaw?.toString() ?? null,
        result.bridgeStatus ?? null,
        result.destinationTxHash ?? null,
        transactionId,
      );
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
