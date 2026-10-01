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
- `networks[].status`: `ok`, `error` (RPC gagal/timeout, lihat `error`),
  `skipped` (alamat jenis itu tidak dikirim), atau `unsupported`.
- Kalau ada jaringan yang gagal atau belum didukung, jawaban tetap `200` dengan
  `isPartial: true`.
- Alamat tidak valid → `400` dengan `error`: `missing_address`,
  `invalid_evm_address`, atau `invalid_solana_address`.
- Saldo per jaringan + alamat di-cache di memori (default 20 detik).
- Log server tidak mencatat query string, jadi alamat wallet tidak ikut
  tercatat.

## Konfigurasi

Lihat [`.env.example`](.env.example). Yang penting:

| Variabel | Fungsi |
| --- | --- |
| `PORT` | Port HTTP (default `8787`) |
| `DATABASE_PATH` | Lokasi file SQLite. Di server, taruh di volume persisten |
| `RPC_URL_<JARINGAN>` | RPC per jaringan. Default-nya node publik yang ada batas request; untuk production pakai provider sendiri |
| `BALANCE_CACHE_TTL_MS` | Lama cache saldo (ms) |
| `RPC_TIMEOUT_MS` | Batas waktu baca saldo per jaringan (ms) |

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
  chains/         # pembaca saldo EVM (viem) & Solana (@solana/kit)
  catalog/        # katalog jaringan/token MVP + pembacanya
  db/             # koneksi SQLite, migrasi, seed
  lib/            # cache & timeout
test/             # tes Vitest
scripts/          # verify-tokens
```
