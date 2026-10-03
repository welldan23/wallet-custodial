/** PENGATURAN CONTOH untuk halaman Pengaturan sebelum pilihan bisa diubah. */
import type { AppSettings } from '@/types/wallet';

export const MOCK_SETTINGS: AppSettings = {
  displayCurrency: 'IDR',
  language: 'id',
  theme: 'light',
  autoLockMinutes: 1,
  biometricSigning: true,
};
