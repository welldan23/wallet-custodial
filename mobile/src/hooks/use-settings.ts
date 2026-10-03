import { MOCK_SETTINGS } from '@/mocks/settings';
import type { AppSettings } from '@/types/wallet';

/** Preferensi aplikasi. Sementara data contoh; bisa diubah di task Pengaturan berikutnya. */
export function useSettings(): { settings: AppSettings } {
  return { settings: MOCK_SETTINGS };
}
