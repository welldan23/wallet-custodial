export type Migration = {
  id: number;
  name: string;
  sql: string;
};

/**
 * Migrasi skema, dijalankan berurutan sekali saja (dicatat di tabel
 * `schema_migrations`). Jangan ubah migrasi yang sudah jalan — tambah baru.
 */
export const MIGRATIONS: Migration[] = [
  {
    id: 1,
    name: 'networks_tokens_prices',
    sql: `
      CREATE TABLE networks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        chain_id TEXT NOT NULL,
        chain_type TEXT NOT NULL CHECK (chain_type IN ('evm', 'solana')),
        native_symbol TEXT NOT NULL,
        explorer_url TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE tokens (
        id TEXT PRIMARY KEY,
        symbol TEXT NOT NULL,
        name TEXT NOT NULL,
        network_id TEXT NOT NULL REFERENCES networks (id),
        contract_address TEXT, -- NULL = koin gas bawaan jaringan
        decimals INTEGER NOT NULL,
        is_stablecoin INTEGER NOT NULL DEFAULT 0,
        is_visible INTEGER NOT NULL DEFAULT 1,
        UNIQUE (network_id, contract_address)
      );

      CREATE TABLE prices (
        id TEXT PRIMARY KEY,
        symbol TEXT NOT NULL UNIQUE,
        usd_price REAL NOT NULL,
        idr_rate REAL NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  },
];
