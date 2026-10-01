# MyWallet — Backend API

API ringan untuk aplikasi MyWallet, dibangun dengan [Hono](https://hono.dev) +
SQLite (`better-sqlite3`). Backend **hanya melayani data publik** (jaringan,
token, harga, dan saldo dari blockchain). Frasa pemulihan dan kunci privat
tidak pernah dikirim ke sini.

## Jalankan

Butuh Node.js 22.12 atau lebih baru.

```bash
cd backend
npm install
cp .env.example .env   # opsional, kalau mau ganti port/RPC
npm run dev            # http://localhost:8787
```

Saat pertama jalan, file SQLite dibuat otomatis (default `./data/mywallet.db`)
lalu diisi daftar jaringan & token MVP.

## Endpoint

### `GET /health`

Cek server hidup → `{ "ok": true }`.

### `GET /v1/networks`

Jaringan aktif (urut `sort_order`) beserta aset yang bisa diterima di tiap
jaringan — dipakai halaman Terima. Data publik, `Cache-Control: public, max-age=300`.

```json
{
  "networks": [
    {
      "id": "arbitrum",
      "name": "Arbitrum",
      "chainId": "42161",
      "chainType": "evm",
      "nativeSymbol": "ETH",
      "explorerUrl": "https://arbiscan.io",
      "assets": [
        { "tokenId": "usdc-arbitrum", "symbol": "USDC", "name": "USD Coin", "decimals": 6,
          "isStablecoin": true, "isNative": false, "contractAddress": "0x…" },
        { "tokenId": "eth-arbitrum", "symbol": "ETH", "name": "Ether", "decimals": 18,
          "isStablecoin": false, "isNative": true, "contractAddress": null }
      ]
    }
  ]
}
```

- Jaringan `is_active = 0` tidak muncul; token `is_visible = 0` (mis. DAI) tidak ikut.
- Urutan aset: stablecoin dulu, koin gas terakhir.

### `GET /v1/fees?network=…&token=…[&from=…&to=…&amount=…]`

Estimasi biaya kirim satu token + metadata jaringan. `from`, `to`, `amount`
(dalam satuan token, mis. `12.5`) opsional — makin lengkap, makin akurat.

```json
{
  "network": { "id": "arbitrum", "chainId": "42161", "chainType": "evm", "nativeSymbol": "ETH",
               "nativeDecimals": 18, "explorerUrl": "https://arbiscan.io",
               "explorerTxUrl": "https://arbiscan.io/tx/{hash}" },
  "token": { "tokenId": "usdc-arbitrum", "symbol": "USDC", "decimals": 6, "isNative": false },
  "fee": { "raw": "1694528371200", "amount": "0.0000016945283712", "usd": 0.004576, "idr": 75,
           "method": "approximate", "parts": [{ "kind": "execution", "raw": "…", "amount": "…" }],
           "gasLimit": "69658", "maxFeePerGas": "24326400", "createsRecipientAccount": null },
  "nativeUsdPrice": 2700.5,
  "isPriceStale": false,
  "estimatedAt": "2026-10-01T10:00:00.000Z"
}
```

- **EVM**: unit gas × `maxFeePerGas` saat ini (+10% margin). `method`:
  `simulated` (disimulasikan dengan pengirim + jumlah asli), `approximate`
  (simulasi jumlah 0 + cadangan slot penerima), `default` (angka gas umum).
  Base menambah biaya data L1 (`parts[].kind = "l1_data"`).
- **Solana**: biaya dasar 5000 lamport + priority fee (median priority fee
  bukan nol terbaru di akun mint × compute unit). Kalau `to` belum punya akun
  token, ada `token_account_rent` (sewa minimum dari RPC) dan
  `createsRecipientAccount: true` — biaya ini dibayar pengirim.
- Tanpa alamat: `Cache-Control: public, max-age=15` dan disimpan 15 detik di
  memori. Dengan alamat: `no-store`.
- Error: `400` parameter salah, `503` jaringan tanpa RPC, `502` RPC gagal/timeout.

### `POST /v1/transactions`

Teruskan transaksi yang **sudah ditandatangani di HP** ke jaringan, lalu catat
di riwayat (`status: "pending"`). Backend tidak pernah menerima kunci/frasa.

```json
{ "network": "arbitrum", "signedTransaction": "0x02f8…" }
```

`signedTransaction`: hex transaksi EVM, atau wire transaction Solana (base64).

Isi riwayat **dibaca dari transaksi itu sendiri**, bukan dari klaim aplikasi:

- **EVM**: pengirim dipulihkan dari tanda tangan, `chainId` wajib cocok. Hanya
  kirim koin gas (`value`, tanpa data) atau `transfer(to, amount)` ERC-20 ke
  kontrak token di katalog.
- **Solana**: tepat satu transfer SOL (System) atau SPL `TransferChecked` untuk
  mint di katalog (desimal dicek). Boleh ditemani compute budget dan pembuatan
  akun token penerima; instruksi lain dan address lookup table ditolak. Penerima
  yang dicatat = pemilik akun token (dari instruksi ATA atau RPC).

Jawaban: `201` tercatat baru, `200` hash yang sama sudah tercatat (tidak
dikirim ulang). Contoh isi `transaction`: `id`, `type`, `status`, `tokenId`,
`amount`, `amountRaw`, `amountUsd`, `counterpartyAddress`, `txHash`, `explorerUrl`.

Error: `400` (`invalid_encoding`, `unsigned`, `wrong_chain`,
`unsupported_transaction`, `unsupported_token`, `invalid_amount`), `422` jaringan
menolak (`insufficient_funds`, `nonce_too_low`, `fee_too_low`,
`blockhash_expired`, `rejected`) — tidak dicatat, `502` RPC tidak bisa dihubungi
(aman kirim ulang transaksi yang sama), `413` body > 64 KB.

### `GET /v1/address-check?network=…&owner=…&to=…`

Cek alamat tujuan terhadap alamat yang pernah dikirimi `owner` (kiriman yang
tidak gagal) — perlindungan dari *address poisoning*.

```json
{
  "result": "lookalike",
  "match": { "address": "0xd8dA6BF2…96045", "timesUsed": 3, "lastUsedAt": "2026-09-30T04:20:00.000Z",
             "networkIds": ["arbitrum", "ethereum"], "samePrefix": 5, "sameSuffix": 5 },
  "checkedAddresses": 4
}
```

- `known` = persis sama, `lookalike` = awal ≥3 & akhir ≥3 karakter sama (total ≥7)
  tapi berbeda (aturan sama dengan aplikasi), `new` = belum pernah dipakai.
- EVM: riwayat semua jaringan EVM ikut dicek (alamatnya sama di semua chain).
- `Cache-Control: no-store` (berisi riwayat pribadi).

### `GET /v1/contacts[?network=…]`

Buku Alamat milik perangkat ini. **Wajib** header
`Authorization: Device <token>` — token acak (≥32 karakter, mis. UUID v4) yang
dibuat & disimpan aman di HP. Backend hanya menyimpan hash SHA-256-nya (tabel
`users.device_id_hash`). Kontak sengaja tidak bisa dibaca dengan alamat wallet,
karena alamat itu publik.

```json
{
  "contacts": [
    { "id": "…", "name": "Deposit Tokocrypto", "address": "0x5b7E…", "chainType": "evm",
      "networkId": "arbitrum", "isFavorite": true, "createdAt": "…", "updatedAt": "…" }
  ]
}
```

- Urutan: favorit dulu, lalu nama.
- `network=arbitrum`: hanya kontak jaringan itu + kontak "semua jaringan"
  (`networkId: null`) dengan tipe alamat yang sama.
- Perangkat yang belum pernah menyimpan kontak mendapat daftar kosong.
- `401` tanpa/salah token, `no-store`.

### `GET /v1/balances/summary?evm=0x…&solana=…`

Ringkasan saldo USDC, USDT, dan koin gas (ETH/POL/SOL) di **semua jaringan**:
Ethereum, Arbitrum, Base, Polygon, dan Solana. Isi minimal salah satu alamat.

```bash
curl "http://localhost:8787/v1/balances/summary?evm=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
```

Contoh jawaban (dipotong):

```json
{
  "owner": { "evm": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", "solana": null },
  "totalUsd": 27959.84,
  "fx": { "USD": 1, "IDR": 16350 },
  "pricesUpdatedAt": "2026-10-01T10:42:00.000Z",
  "isPartial": false,
  "networks": [
    { "networkId": "ethereum", "status": "ok", "totalUsd": 17365.06 },
    { "networkId": "solana", "status": "skipped", "totalUsd": 0 }
  ],
  "balances": [
    {
      "tokenId": "usdc-ethereum",
      "networkId": "ethereum",
      "symbol": "USDC",
      "name": "USD Coin",
      "decimals": 6,
      "isStablecoin": true,
      "isNative": false,
      "raw": "37192124",
      "amount": "37.192124",
      "usdPrice": 1,
      "valueUsd": 37.192124
    }
  ],
  "updatedAt": "2026-10-01T11:00:00.000Z"
}
```

- `amount` dan `raw` berupa string supaya presisi tidak hilang (`raw` = satuan
  terkecil, mis. wei/lamport).
- Saldo nol tetap dikirim, supaya aplikasi bisa menampilkan status "gas kosong".
- `networks[].status`:
  - `ok`: saldo terbaca (dari RPC atau cache yang masih segar)
  - `stale`: RPC gagal, memakai saldo terakhir yang tersimpan (lihat
    `fetchedAt` dan `error`)
  - `error`: RPC gagal dan tidak ada saldo tersimpan
  - `skipped`: alamat jenis itu tidak dikirim
  - `unsupported`: belum ada RPC untuk jaringan itu
- `networks[].fetchedAt`: kapan saldo jaringan itu dibaca dari blockchain.
- Jawaban tetap `200` walau ada masalah: `isStale: true` kalau ada jaringan
  yang memakai saldo lama, `isPartial: true` kalau ada jaringan yang tidak
  terbaca sama sekali.
- Alamat tidak valid → `400` dengan `error`: `missing_address`,
  `invalid_evm_address`, atau `invalid_solana_address`.
- Log server tidak mencatat query string, jadi alamat wallet tidak ikut
  tercatat.

### `GET /v1/prices`

Harga token yang tampil di aplikasi + kurs USD→Rupiah. Sama untuk semua
pengguna, jadi boleh di-cache 30 detik.

```json
{
  "base": "USD",
  "fx": { "USD": 1, "IDR": 17891 },
  "prices": [
    { "symbol": "USDC", "usdPrice": 0.99983, "idrPrice": 17887.96, "updatedAt": "2026-10-01T07:03:06.569Z" },
    { "symbol": "ETH", "usdPrice": 2712.8, "idrPrice": 48534773.31, "updatedAt": "2026-10-01T07:03:06.569Z" }
  ],
  "updatedAt": "2026-10-01T07:03:06.569Z",
  "isStale": false
}
```

## Cache saldo (SQLite)

Saldo terakhir per jaringan + alamat disimpan di tabel `balance_cache`, jadi
tetap ada walau server restart:

- Saldo yang lebih muda dari `BALANCE_CACHE_TTL_MS` (default 20 detik)
  dipakai langsung tanpa memanggil RPC. Permintaan bersamaan untuk alamat
  yang sama cukup memicu satu pembacaan.
- Kalau RPC gagal, saldo tersimpan yang umurnya masih di bawah
  `BALANCE_MAX_STALE_MS` (default 24 jam) tetap dikirim dengan status `stale`.
- **Alamat wallet tidak disimpan mentah.** Kuncinya HMAC-SHA256 dari alamat
  dengan `CACHE_KEY_SECRET`, jadi kalau database bocor, isinya tidak
  menunjukkan alamat siapa saja yang memakai MyWallet. Isi `CACHE_KEY_SECRET`
  di production. Kalau kosong, server memakai kunci acak per proses.
- Data yang lebih tua dari `BALANCE_CACHE_RETENTION_MS` (default 7 hari)
  dihapus otomatis tiap jam.

Harga dan kurs juga tersimpan di SQLite (tabel `prices`), lihat bagian berikut.

## Tabel transaksi

Migrasi 4 membuat tabel `transactions` (riwayat kirim/terima/swap) mengikuti PRD,
dengan dua penyesuaian:

- **`wallet_key`** = HMAC alamat pemilik (seperti `balance_cache`), menggantikan
  `user_id`/`wallet_id` sampai tabel `users`/`wallets` dibuat. Alamat wallet asli
  tidak disimpan.
- **`amount_raw` / `fee_raw`** = satuan terkecil (wei/lamport) sebagai teks, bukan
  REAL, supaya jumlah tidak meleset karena pembulatan.

Status: `pending` → `success` / `failed`. Satu `tx_hash` hanya sekali per wallet +
jaringan.

## Harga & kurs

Server memperbarui tabel `prices` secara otomatis:

- **Harga USD** tiap 60 detik dari [DefiLlama](https://defillama.com/docs/api)
  (gratis, tanpa key). Kalau gagal atau ada simbol yang tidak ketemu, dicoba
  ke CoinGecko.
- **Kurs USD→IDR** tiap 1 jam dari [Frankfurter](https://frankfurter.dev)
  (kurs referensi ECB), cadangannya [open.er-api.com](https://open.er-api.com).
- Kalau semua sumber gagal, harga lama tetap dipakai dan `isStale` jadi
  `true`. Aplikasi bisa menampilkan peringatan alih-alih angka nol.
- Harga awal dari seed sengaja bertanda kedaluwarsa sampai refresh pertama
  berhasil (biasanya beberapa detik setelah server menyala).

## Konfigurasi

Lihat [`.env.example`](.env.example). Yang penting:

| Variabel | Fungsi |
| --- | --- |
| `PORT` | Port HTTP (default `8787`) |
| `DATABASE_PATH` | Lokasi file SQLite. Di server, taruh di volume persisten |
| `RPC_URL_<JARINGAN>` | RPC per jaringan. Default-nya node publik yang ada batas request; untuk production pakai provider sendiri |
| `BALANCE_CACHE_TTL_MS` | Umur saldo tersimpan yang masih dianggap segar (default 20 detik) |
| `BALANCE_MAX_STALE_MS` | Batas umur saldo lama yang boleh dipakai saat RPC gagal (default 24 jam) |
| `BALANCE_CACHE_RETENTION_MS` | Saldo tersimpan lebih tua dari ini dihapus (default 7 hari) |
| `CACHE_KEY_SECRET` | Kunci HMAC untuk menyamarkan alamat di cache. **Wajib di production** |
| `RPC_TIMEOUT_MS` | Batas waktu baca saldo per jaringan (ms) |
| `PRICE_REFRESH_INTERVAL_MS` | Interval refresh harga (default 60 detik) |
| `FX_REFRESH_INTERVAL_MS` | Interval refresh kurs (default 1 jam) |
| `PRICE_STALE_AFTER_MS` | Batas umur harga sebelum ditandai `isStale` (default 15 menit) |
| `COINGECKO_API_KEY` | Opsional, API key demo CoinGecko untuk sumber cadangan |

## Perintah lain

```bash
npm test               # tes otomatis (Vitest)
npm run typecheck      # cek tipe TypeScript
npm run build          # kompilasi ke dist/, lalu jalankan: npm start
npm run verify:tokens  # cek alamat kontrak token langsung ke blockchain
```

Jalankan `npm run verify:tokens` tiap kali menambah atau mengubah token di
`src/catalog/mvp.ts`.

## Struktur

```
src/
  index.ts        # titik masuk server
  app.ts          # rakitan Hono (middleware + route)
  routes/         # endpoint HTTP
  services/       # logika ringkasan saldo
  prices/         # sumber harga & kurs + PriceService (refresh berkala)
  chains/         # pembaca saldo EVM (viem) & Solana (@solana/kit)
  catalog/        # katalog jaringan/token MVP + pembacanya
  db/             # koneksi SQLite, migrasi, seed
  cache/          # cache saldo di SQLite (alamat di-HMAC)
  lib/            # batas waktu (timeout)
test/             # tes Vitest
scripts/          # verify-tokens
```
