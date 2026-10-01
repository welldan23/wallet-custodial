import { createHmac } from 'node:crypto';

/**
 * Samarkan alamat wallet sebelum disimpan (HMAC-SHA256). Dipakai sebagai
 * `owner_key`/`wallet_key` supaya database tidak berisi alamat pengguna.
 * Alamat EVM harus sudah dalam format checksum agar hasilnya konsisten.
 */
export const createWalletKey =
  (secret: string) =>
  (address: string): string =>
    createHmac('sha256', secret).update(address).digest('hex');
