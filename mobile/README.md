# MyWallet — Aplikasi Mobile

Wallet stablecoin non-custodial untuk iOS & Android, dibangun dengan
[Expo](https://expo.dev) SDK 57 + Expo Router + NativeWind (Tailwind).

> **Status:** frontend masih pakai **data tiruan** (`src/mocks/`). Belum ada
> koneksi ke backend, RPC, atau kunci wallet asli.

## Jalankan di HP (paling cepat)

1. Install dependency:

   ```bash
   cd mobile
   npm install
   ```

2. Nyalakan server pengembangan:

   ```bash
   npx expo start
   ```

3. Install aplikasi **Expo Go** di HP (Play Store / App Store), lalu scan QR
   yang muncul di terminal:
   - Android: scan pakai Expo Go.
   - iPhone: scan pakai aplikasi Kamera.

   HP dan laptop harus di Wi-Fi yang sama. Kalau beda jaringan, pakai
   `npx expo start --tunnel`.

## Ganti skenario data tiruan

Buat ngetes tampilan saat wallet kosong, pakai env `EXPO_PUBLIC_MOCK_WALLET`:

| Nilai | Isi wallet |
| --- | --- |
| `funded` (default) | Ada stablecoin & koin gas (gas Ethereum menipis, Polygon kosong) |
| `empty` | Wallet baru, belum ada aset sama sekali |
| `no-gas` | Cuma punya stablecoin, belum punya koin gas |

```bash
EXPO_PUBLIC_MOCK_WALLET=empty npx expo start --clear
```

Tambahkan `--clear` tiap ganti nilai, soalnya nilainya ditanam ke kode pas
build dan bisa nyangkut di cache.

## Lihat di browser

```bash
npx expo start --web
```

Tampilan web cuma buat ngecek UI sekilas. Fitur yang butuh modul native
(secure store, biometrik) nantinya harus dites di HP lewat *development
build* (`npx eas-cli@latest build --profile development`).

## Cek kode

```bash
npx tsc --noEmit   # cek tipe TypeScript
npx expo lint      # cek kerapian kode
```

## Struktur folder

```
src/
  app/          # halaman (Expo Router) — (tabs)/index.tsx = Home
  components/   # komponen UI (home/, crypto/, ui/)
  hooks/        # hook data, mis. use-portfolio
  i18n/         # teks Bahasa Indonesia & Inggris
  lib/          # logika murni: format angka, hitung portofolio
  mocks/        # data tiruan (diganti API/RPC nanti)
  theme/        # palet warna hijau (dipakai Tailwind & kode TS)
  types/        # tipe data wallet (jaringan, token, harga, saldo)
```
