import type { RawBalance } from '../chains/types.js';
import type { Db } from '../db/database.js';

export type StoredBalances = {
  balances: RawBalance[];
  /** Kapan saldo ini dibaca dari RPC (ISO). */
  fetchedAt: string;
};

/** Penyimpanan saldo terakhir per jaringan + pemilik (kunci pemilik sudah di-hash). */
export interface BalanceStore {
  get(networkId: string, ownerKey: string): StoredBalances | null;
  set(networkId: string, ownerKey: string, balances: RawBalance[], fetchedAt: string): void;
  /** Hapus data yang dibaca sebelum `cutoff`. Mengembalikan jumlah baris terhapus. */
  purgeOlderThan(cutoff: Date): number;
}

type Row = { tokenId: string; rawBalance: string; fetchedAt: string };

export class SqliteBalanceStore implements BalanceStore {
  private readonly selectRows;
  private readonly deleteRows;
  private readonly insertRow;
  private readonly purgeRows;

  constructor(private readonly db: Db) {
    this.selectRows = db.prepare(`
      SELECT token_id AS tokenId, raw_balance AS rawBalance, fetched_at AS fetchedAt
      FROM balance_cache WHERE network_id = ? AND owner_key = ?
      ORDER BY rowid
    `);
    this.deleteRows = db.prepare(
      'DELETE FROM balance_cache WHERE network_id = ? AND owner_key = ?',
    );
    this.insertRow = db.prepare(`
      INSERT INTO balance_cache (network_id, owner_key, token_id, raw_balance, fetched_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    this.purgeRows = db.prepare('DELETE FROM balance_cache WHERE fetched_at < ?');
  }

  get(networkId: string, ownerKey: string): StoredBalances | null {
    const rows = this.selectRows.all(networkId, ownerKey) as Row[];
    if (rows.length === 0) return null;
    return {
      balances: rows.map((row) => ({ tokenId: row.tokenId, raw: BigInt(row.rawBalance) })),
      // Semua baris ditulis bersamaan; ambil yang tertua untuk berjaga-jaga.
      fetchedAt: rows.reduce(
        (oldest, row) => (row.fetchedAt < oldest ? row.fetchedAt : oldest),
        rows[0]!.fetchedAt,
      ),
    };
  }

  set(networkId: string, ownerKey: string, balances: RawBalance[], fetchedAt: string): void {
    this.db.transaction(() => {
      this.deleteRows.run(networkId, ownerKey);
      for (const balance of balances) {
        this.insertRow.run(networkId, ownerKey, balance.tokenId, balance.raw.toString(), fetchedAt);
      }
    })();
  }

  purgeOlderThan(cutoff: Date): number {
    return this.purgeRows.run(cutoff.toISOString()).changes;
  }
}
