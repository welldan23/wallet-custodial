import type { AppSettings } from '@/types/wallet';

export const SETTINGS_STORAGE_KEY = 'mywallet.settings.v1';

export const DEFAULT_SETTINGS: AppSettings = {
  displayCurrency: 'IDR',
  language: 'id',
  theme: 'light',
  autoLockMinutes: 1,
  biometricSigning: true,
};

/** Pilihan kunci otomatis (menit). */
export const AUTO_LOCK_OPTIONS = [0, 1, 5, 15] as const;

const oneOf = <T extends string>(value: unknown, options: readonly T[], fallback: T): T =>
  options.includes(value as T) ? (value as T) : fallback;

/**
 * Baca pengaturan tersimpan. Isi yang rusak atau dari versi lama diganti
 * nilai bawaan per kolom, jadi satu kolom salah tidak menghapus yang lain.
 */
export function parseStoredSettings(raw: string | null): AppSettings {
  let stored: Record<string, unknown> = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      stored = parsed as Record<string, unknown>;
    }
  } catch {
    // JSON rusak = pakai bawaan.
  }
  return {
    displayCurrency: oneOf(
      stored.displayCurrency,
      ['IDR', 'USD'],
      DEFAULT_SETTINGS.displayCurrency,
    ),
    language: oneOf(stored.language, ['id', 'en'], DEFAULT_SETTINGS.language),
    theme: oneOf(stored.theme, ['light', 'dark', 'system'], DEFAULT_SETTINGS.theme),
    autoLockMinutes: (AUTO_LOCK_OPTIONS as readonly number[]).includes(
      stored.autoLockMinutes as number,
    )
      ? (stored.autoLockMinutes as number)
      : DEFAULT_SETTINGS.autoLockMinutes,
    biometricSigning:
      typeof stored.biometricSigning === 'boolean'
        ? stored.biometricSigning
        : DEFAULT_SETTINGS.biometricSigning,
  };
}
