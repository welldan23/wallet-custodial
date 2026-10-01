/** Validasi `YYYY-MM`. */
export const isMonth = (value: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

/**
 * Rentang UTC [from, to) untuk satu bulan kalender di zona waktu pengguna.
 * `offsetMinutes` = selisih zona dari UTC (WIB = +420, WITA = +480, WIT = +540).
 * Contoh: Oktober 2026 WIB = 2026-09-30T17:00Z sampai 2026-10-31T17:00Z.
 */
export function monthRange(month: string, offsetMinutes: number): { from: string; to: string } {
  const [year, index] = month.split('-').map(Number) as [number, number];
  const offsetMs = offsetMinutes * 60_000;
  return {
    from: new Date(Date.UTC(year, index - 1, 1) - offsetMs).toISOString(),
    to: new Date(Date.UTC(year, index, 1) - offsetMs).toISOString(),
  };
}
