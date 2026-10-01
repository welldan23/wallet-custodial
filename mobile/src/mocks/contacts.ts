/**
 * KONTAK CONTOH untuk mengisi Buku Alamat sebelum fitur kelola kontak
 * (fase 3) dibuat. Alamatnya acak — jangan kirim aset ke sini.
 */
import type { Contact } from '@/types/wallet';

export const MOCK_CONTACTS: Contact[] = [
  {
    id: 'kontak-tokocrypto',
    name: 'Deposit Tokocrypto',
    address: '0x5b7E0D3A9F1C4e2a6B8d0f1E3C5a7b9d1E3F5a7C',
    networkId: 'arbitrum',
    isFavorite: true,
  },
  {
    id: 'kontak-rekening-sendiri',
    name: 'Wallet Tabungan',
    address: '0x9C2e4A6b8d0f1E3a5C7E9B1d3f5a7c9E1b3D5f7A',
    networkId: null,
    isFavorite: true,
  },
  {
    id: 'kontak-budi',
    name: 'Budi (desainer)',
    address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    networkId: 'solana',
    isFavorite: false,
  },
  {
    id: 'kontak-indodax',
    name: 'Deposit Indodax',
    address: '0x1f3a5c7E9B1d3F5a7c9E1B3d5F7A9c2E4A6B8D0f',
    networkId: 'ethereum',
    isFavorite: false,
  },
];

/**
 * Alamat yang pernah dipakai sebagai penerima (contoh). Nanti dari Riwayat.
 * Dipakai untuk mendeteksi alamat mirip (address poisoning).
 */
export const MOCK_RECENT_RECIPIENTS: string[] = [
  '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
  '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
];
