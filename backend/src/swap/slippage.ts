/**
 * Aturan slippage — sama dengan aplikasi mobile (`mobile/src/lib/slippage.ts`):
 * persen > 0 dan ≤ 50, maksimal 2 angka di belakang koma.
 */
export const MAX_SLIPPAGE_PERCENT = 50;
/** Di bawah ini swap rawan gagal karena kurs bergeser sedikit saja. */
export const LOW_SLIPPAGE_PERCENT = 0.05;
/** Di atas ini (untuk stablecoin) rawan dirugikan bot front-run. */
export const HIGH_SLIPPAGE_PERCENT = 1;

export type SlippageCheck =
  | { ok: true; bps: number; percent: number; warning: 'low' | 'high' | null }
  | { ok: false; reason: 'format' | 'zero' | 'too_high' };

/** Validasi slippage dalam persen (mis. `"0.5"`) lalu ubah ke basis poin. */
export function checkSlippage(input: string): SlippageCheck {
  const value = input.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return { ok: false, reason: 'format' };
  const percent = Number(value);
  if (!(percent > 0)) return { ok: false, reason: 'zero' };
  if (percent > MAX_SLIPPAGE_PERCENT) return { ok: false, reason: 'too_high' };
  const warning =
    percent < LOW_SLIPPAGE_PERCENT ? 'low' : percent > HIGH_SLIPPAGE_PERCENT ? 'high' : null;
  return { ok: true, bps: Math.round(percent * 100), percent, warning };
}
