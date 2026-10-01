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

### `GET /v1/transactions/:id`

Status kiriman (id = UUID dari `POST /v1/transactions`). Selama `pending`,
backend mengecek blockchain (paling sering tiap 5 detik per transaksi) lalu
menyimpan hasilnya.

```json
{ "transaction": { "id": "…", "status": "success", "feeRaw": "812700000000", "…": "…" },
  "isFinal": true, "isStuck": false, "checkFailed": false }
```

- **EVM**: receipt `success` → `success`, `reverted` → `failed`, dengan biaya
  asli (`gasUsed × effectiveGasPrice`, + biaya L1 di Base). Belum ada receipt
  → tetap `pending`; lebih dari 30 menit ditandai `isStuck: true` (bukan gagal).
- **Solana**: `confirmed`/`finalized` → selesai (`failed` kalau ada error
  eksekusi), biaya dari `meta.fee`. Tidak pernah terlihat setelah 3 menit
  (blockhash kedaluwarsa) → `failed`.
- RPC gagal → status terakhir dengan `checkFailed: true`. `404` id tidak ada.

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

### `GET /v1/swap/tokens`

Stablecoin yang bisa ditukar, per jaringan aktif. Data publik, cache 5 menit.

```json
{
  "networks": [
    { "id": "arbitrum", "name": "Arbitrum", "chainType": "evm", "sameChainProvider": "lifi",
      "tokens": [{ "tokenId": "usdc-arbitrum", "symbol": "USDC", "name": "USD Coin",
                   "decimals": 6, "contractAddress": "0xaf88…5831" }] },
    { "id": "solana", "name": "Solana", "chainType": "solana", "sameChainProvider": "jupiter",
      "tokens": [] }
  ],
  "bridgeProvider": "lifi"
}
```

Swap satu jaringan: LI.FI (EVM) atau Jupiter (Solana). Beda jaringan: bridge
LI.FI. Koin gas tidak ikut (Swap khusus antar stablecoin).

### `GET /v1/swap/quote?from=…&to=…&amount=…[&slippage=0.5&fromAddress=…&toAddress=…]`

Estimasi swap antar stablecoin (token id, mis. `usdc-arbitrum` → `usdt-arbitrum`).
`amount` dalam satuan token, `slippage` dalam persen (default `0.5`).

```json
{
  "provider": "lifi", "tool": "kyberswap", "crossChain": false,
  "from": { "tokenId": "usdc-arbitrum", "symbol": "USDC", "amount": "100", "amountRaw": "100000000" },
  "to": { "tokenId": "usdt-arbitrum", "symbol": "USDT", "amount": "99.789709", "minAmount": "99.29076", "…": "…" },
  "rate": 0.99789709, "slippageBps": 50, "slippagePercent": 0.5, "priceImpactPct": null,
  "fees": [{ "kind": "provider", "label": "LIFI Fixed Fee", "symbol": "USDC", "amount": "0.25", "usd": 0.25, "included": true }],
  "includedFeesUsd": 0.249983, "networkFeesUsd": 0.019266,
  "etaSeconds": 0, "quoteId": "…", "approvalAddress": "0x1231…4EaE",
  "warnings": [], "quotedAt": "…", "expiresAt": "… (+30 detik)"
}
```

- **Slippage** (aturan sama dengan aplikasi): > 0 dan ≤ 50%, maks 2 desimal →
  `400 invalid_slippage` (`reason`: `format` / `zero` / `too_high`).
- **`warnings`**: `slippage_low` (< 0,05%), `slippage_high` (> 1%), `poor_rate`
  (kurs < 0,98 — wajar untuk dicek ulang, mis. bridge mahal), `high_price_impact` (> 1%).
- Quote berlaku 30 detik (`expiresAt`). Tanpa alamat, quote yang sama disimpan
  10 detik di memori supaya batas request agregator aman.
- Error: `400` parameter salah, `422` `no_route` / `amount_too_small` /
  `unsupported_pair`, `502` agregator gagal, `503` layanan quote tidak dikonfigurasi.

### `POST /v1/swap/prepare` → `POST /v1/swap/execute`

Swap sungguhan, tetap **non-custodial** (tanda tangan selalu di HP):

1. **`prepare`** — body sama dengan parameter `/quote`, `fromAddress` wajib
   (`toAddress` wajib kalau tipe jaringan tujuan beda). Jawaban:
   `intentId` (berlaku 2 menit, sekali pakai), `quote` (bentuk `/quote`),
   `transaction` (EVM: `to`/`data`/`value`/`gasLimit`; Solana:
   `serializedTransaction` base64 belum ditandatangani), dan `approval` kalau
   token asal EVM belum diberi izin — **jumlahnya persis sebesar swap**, bukan
   izin tak terbatas.
2. **`execute`** — `{ "intentId": "…", "signedTransaction": "…", "signedApproval": "…" }`.
   Backend memastikan yang ditandatangani **sama persis** dengan yang disiapkan
   (EVM: chain, tujuan, data, nilai, penanda tangan; Solana: byte pesan +
   tanda tangan pembayar biaya). Lalu approve (kalau ada) dan swap disiarkan
   berurutan, dan swap dicatat (`transactions` + `swap_details`, status `pending`).

Status swap dipantau lewat `GET /v1/transactions/:id` (ikut membawa `swap`:
koin tujuan, perkiraan / minimal / diterima, status bridge).

Error `execute`: `400` isi tidak cocok (`unsupported_transaction`), penanda
tangan lain (`unsigned`), `approval_required`; `410 intent_expired`; `422`
jaringan menolak (mis. `insufficient_funds`); `502` RPC tidak bisa dihubungi.

### `GET /v1/swap/:id` dan `GET /v1/swap/history?evm=…&solana=…`

**Status satu swap** (bentuk jawaban sama dengan `GET /v1/transactions/:id`).
Selama `pending`, backend cek (maks tiap 5 detik):

1. transaksi asal di jaringannya (receipt EVM / signature Solana);
2. kalau asal sudah sukses:
   - **swap satu jaringan** → `success`; jumlah diterima dari status LI.FI
     atau, untuk Jupiter, dari selisih saldo token di transaksi Solana-nya;
   - **bridge** → status LI.FI `/v1/status`: `DONE` → `success` (+ hash &
     jumlah di jaringan tujuan), `FAILED` → `failed`, `DONE`+`REFUNDED` →
     `failed` dengan `bridgeStatus: "refunded"` (koin dikembalikan), lainnya
     tetap `pending`.

**Riwayat swap**: semua swap milik alamat EVM dan/atau Solana itu, terbaru
dulu. `limit` (default 20, maks 50) dan `before` = `nextBefore` dari halaman
sebelumnya. Status yang tampil = status tersimpan; detail terbaru lewat
`GET /v1/swap/:id`.

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

### Sumber riwayat (migrasi 7)

- `transactions.source`: `app` = dicatat aplikasi saat kirim/swap, `chain` =
  diimpor dari blockchain (mis. uang masuk dari exchange/teman). Impor tidak
  pernah menimpa baris yang sudah ada (unik per wallet + jaringan + hash).
- `transactions.block_time`: waktu blok; transaksi impor memakai waktu blok
  sebagai `created_at` supaya urutan riwayat sesuai blockchain.
- `history_sync`: posisi terakhir impor per wallet + jaringan (`cursor` =
  nomor blok EVM / signature Solana), supaya sinkron berikutnya tidak membaca
  ulang dari awal.

### Riwayat swap

Swap dicatat sebagai baris `transactions` bertipe `swap` (sisi asal: token,
jumlah, jaringan, hash; `counterparty_address` = kontrak router agregator) plus
satu baris `swap_details` (migrasi 6):

| Kolom | Isi |
| --- | --- |
| `provider` | `lifi` (EVM & bridge) atau `jupiter` (Solana) |
| `to_network_id`, `to_token_id` | koin tujuan |
| `quoted_amount_raw` / `min_amount_raw` | perkiraan & batas bawah setelah slippage (satuan terkecil) |
| `received_amount_raw` | jumlah yang benar-benar diterima (`NULL` sampai selesai) |
| `slippage_bps` | slippage dalam basis poin (50 = 0,5%) |
| `bridge_status`, `destination_tx_hash` | khusus swap beda jaringan |

`min ≤ quoted` dicek di kode (BigInt), karena jumlah 18 desimal melebihi INTEGER SQLite.

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
| `LIFI_API_KEY` / `LIFI_INTEGRATOR` | Opsional, key & nama integrator LI.FI (batas request lebih longgar) |
| `JUPITER_BASE_URL` / `JUPITER_API_KEY` | Default `https://lite-api.jup.ag` (gratis); `https://api.jup.ag` butuh key |
| `SWAP_QUOTE_TIMEOUT_MS` | Batas waktu minta quote ke agregator (default 10 detik) |

## Quote swap (agregator)

`src/swap/` menyeragamkan quote dari dua agregator:

- **Jupiter** (`/swap/v1/quote`) untuk swap di dalam Solana. Biaya jaringan
  tidak diberi Jupiter, jadi dihitung sendiri: 5000 lamport + priority fee
  median (bukan nol) di akun mint × 300 ribu compute unit. Kalau Jupiter error,
  otomatis dicoba lewat LI.FI.
- **LI.FI** (`/v1/quote`) untuk swap EVM dan semua swap beda jaringan
  (termasuk EVM ↔ Solana). Biaya LI.FI (saat ini 0,25%) dan bridge sudah
  dipotong dari jumlah diterima; biaya gas dibayar terpisah.

`summarizeQuote` menghasilkan jumlah keluar & minimal diterima, kurs setelah
biaya, dan biaya dalam USD yang dipisah: `includedFeesUsd` (dipotong) vs
`networkFeesUsd` (bayar terpisah dengan koin gas). Quote tanpa alamat pengguna
memakai alamat pengganti (tidak pernah dipakai mengirim).

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
