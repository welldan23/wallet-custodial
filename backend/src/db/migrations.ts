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
  {
    id: 2,
    name: 'balance_cache',
    sql: `
      -- Saldo terakhir yang terbaca dari RPC, per jaringan + pemilik.
      -- owner_key = HMAC dari alamat (alamat asli tidak disimpan).
      CREATE TABLE balance_cache (
        network_id TEXT NOT NULL REFERENCES networks (id),
        owner_key TEXT NOT NULL,
        token_id TEXT NOT NULL REFERENCES tokens (id),
        raw_balance TEXT NOT NULL, -- satuan terkecil (wei/lamport) sebagai teks
        fetched_at TEXT NOT NULL,
        PRIMARY KEY (network_id, owner_key, token_id)
      );

      CREATE INDEX balance_cache_fetched_at ON balance_cache (fetched_at);
    `,
  },
  {
    id: 3,
    name: 'networks_sort_order',
    sql: `
      -- Urutan tampil jaringan (kecil dulu). Sebelumnya bergantung pada rowid,
      -- yang berubah kalau jaringan dihapus lalu ditambah lagi.
      ALTER TABLE networks ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
      UPDATE networks SET sort_order = rowid;
      CREATE INDEX networks_sort_order ON networks (sort_order);
    `,
  },
  {
    id: 4,
    name: 'transactions',
    sql: `
      -- Riwayat transaksi (tabel transactions di PRD), dimulai dari kiriman.
      -- Beda dengan PRD:
      -- * wallet_key = HMAC alamat pengirim/pemilik, menggantikan user_id/wallet_id
      --   sampai tabel users/wallets ada (alamat wallet asli tidak disimpan).
      -- * amount_raw/fee_raw = satuan terkecil (wei/lamport) sebagai teks supaya
      --   tidak ada pembulatan REAL; tampilan dihitung dari tokens.decimals.
      CREATE TABLE transactions (
        id TEXT PRIMARY KEY,
        wallet_key TEXT NOT NULL,
        network_id TEXT NOT NULL REFERENCES networks (id),
        token_id TEXT NOT NULL REFERENCES tokens (id),
        type TEXT NOT NULL CHECK (type IN ('send', 'receive', 'swap')),
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
        amount_raw TEXT NOT NULL CHECK (amount_raw GLOB '[0-9]*' AND amount_raw NOT GLOB '*[^0-9]*'),
        amount_usd REAL, -- nilai USD saat transaksi dibuat (snapshot)
        fee_raw TEXT CHECK (fee_raw IS NULL OR (fee_raw GLOB '[0-9]*' AND fee_raw NOT GLOB '*[^0-9]*')),
        counterparty_address TEXT NOT NULL,
        tx_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (wallet_key, network_id, tx_hash)
      );

      CREATE INDEX transactions_wallet_created ON transactions (wallet_key, created_at DESC);
      CREATE INDEX transactions_pending ON transactions (status) WHERE status = 'pending';
    `,
  },
  {
    id: 5,
    name: 'users_contacts',
    sql: `
      -- Pengguna anonim per perangkat (tabel users di PRD). device_id_hash =
      -- SHA-256 token acak dari HP; token aslinya tidak disimpan.
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        device_id_hash TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL
      );

      -- Buku Alamat (tabel contacts di PRD) + is_favorite untuk urutan tampil.
      -- network_id NULL = bisa dipakai di semua jaringan bertipe sama.
      CREATE TABLE contacts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 60),
        address TEXT NOT NULL,
        chain_type TEXT NOT NULL CHECK (chain_type IN ('evm', 'solana')),
        network_id TEXT REFERENCES networks (id),
        is_favorite INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- COALESCE: di SQLite NULL dianggap berbeda, jadi UNIQUE biasa tidak cukup.
      CREATE UNIQUE INDEX contacts_unique ON contacts (user_id, address, COALESCE(network_id, ''));
    `,
  },
  {
    id: 6,
    name: 'swap_details',
    sql: `
      -- Detail swap, 1:1 dengan baris transactions bertipe 'swap'. Sisi asal
      -- (token, jumlah, jaringan, hash) ada di transactions; counterparty_address
      -- = kontrak router agregator.
      CREATE TABLE swap_details (
        transaction_id TEXT PRIMARY KEY REFERENCES transactions (id) ON DELETE CASCADE,
        provider TEXT NOT NULL CHECK (provider IN ('lifi', 'jupiter')),
        to_network_id TEXT NOT NULL REFERENCES networks (id),
        to_token_id TEXT NOT NULL REFERENCES tokens (id),
        -- Satuan terkecil token tujuan, sebagai teks (angka bulat ≥ 0).
        quoted_amount_raw TEXT NOT NULL CHECK (quoted_amount_raw GLOB '[0-9]*' AND quoted_amount_raw NOT GLOB '*[^0-9]*'),
        min_amount_raw TEXT NOT NULL CHECK (min_amount_raw GLOB '[0-9]*' AND min_amount_raw NOT GLOB '*[^0-9]*'),
        received_amount_raw TEXT CHECK (received_amount_raw IS NULL OR (received_amount_raw GLOB '[0-9]*' AND received_amount_raw NOT GLOB '*[^0-9]*')),
        slippage_bps INTEGER NOT NULL CHECK (slippage_bps BETWEEN 1 AND 5000),
        -- Swap beda jaringan: status bridge + hash di jaringan tujuan.
        bridge_status TEXT CHECK (bridge_status IS NULL OR bridge_status IN ('pending', 'done', 'failed', 'refunded')),
        destination_tx_hash TEXT,
        -- min ≤ quoted dicek di kode (BigInt): angka 18 desimal melebihi INTEGER SQLite.
        quote_id TEXT
      );

      CREATE INDEX swap_details_bridge_pending ON swap_details (bridge_status)
        WHERE bridge_status = 'pending';
    `,
  },
];
