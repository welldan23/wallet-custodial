/** Durasi kunci otomatis dari Pengaturan (menit) → milidetik. `0` = langsung. */
export const autoLockMs = (minutes: number) => Math.max(0, minutes) * 60_000;

/** Bawaan: 1 menit di latar belakang. */
export const AUTO_LOCK_AFTER_MS = autoLockMs(1);

/** Perlu dikunci lagi saat kembali aktif? `backgroundAt` = waktu app ke latar belakang. */
export function shouldLockOnResume(
  backgroundAt: number | null,
  now: number,
  lockAfterMs: number = AUTO_LOCK_AFTER_MS,
): boolean {
  return backgroundAt !== null && now - backgroundAt >= lockAfterMs;
}
