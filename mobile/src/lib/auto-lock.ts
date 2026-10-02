/** Kunci otomatis setelah app di latar belakang selama ini (nanti diatur di Pengaturan). */
export const AUTO_LOCK_AFTER_MS = 60_000;

/** Perlu dikunci lagi saat kembali aktif? `backgroundAt` = waktu app ke latar belakang. */
export function shouldLockOnResume(
  backgroundAt: number | null,
  now: number,
  lockAfterMs: number = AUTO_LOCK_AFTER_MS,
): boolean {
  return backgroundAt !== null && now - backgroundAt >= lockAfterMs;
}
