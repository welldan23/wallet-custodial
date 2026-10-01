import { normalizeAmountInput } from './amount';

/** Pilihan cepat slippage dalam persen. */
export const SLIPPAGE_PRESETS = [0.1, 0.5, 1] as const;

/** Bawaan untuk stablecoin: cukup longgar biar jarang gagal, tetap aman. */
export const DEFAULT_SLIPPAGE = 0.5;

/** Batas atas yang masih diizinkan sama sekali (persen). */
export const MAX_SLIPPAGE = 50;
/** Di bawah ini swap rawan gagal karena kurs bergeser sedikit saja. */
const LOW_SLIPPAGE = 0.05;
/** Di atas ini (untuk stablecoin) kamu rawan dirugikan bot front-run. */
const HIGH_SLIPPAGE = 1;

export type SlippageCheck =
  | { status: 'empty' }
  | { status: 'invalid'; reason: 'format' | 'zero' | 'too_high' }
  | { status: 'valid'; value: number; warning: 'low' | 'high' | null };

/** Validasi ketikan slippage kustom (persen; koma atau titik desimal). */
export function checkSlippage(input: string): SlippageCheck {
  const normalized = normalizeAmountInput(input.replace('%', ''));
  if (!normalized) return { status: 'empty' };
  if (!/^\d*\.?\d{0,2}$/.test(normalized) || normalized === '.') {
    return { status: 'invalid', reason: 'format' };
  }
  const value = Number(normalized);
  if (!(value > 0)) return { status: 'invalid', reason: 'zero' };
  if (value > MAX_SLIPPAGE) return { status: 'invalid', reason: 'too_high' };
  const warning = value < LOW_SLIPPAGE ? 'low' : value > HIGH_SLIPPAGE ? 'high' : null;
  return { status: 'valid', value, warning };
}

/** Jumlah minimal yang pasti diterima; kalau kurs lebih buruk, swap dibatalkan. */
export const minReceived = (toAmount: number, slippagePercent: number) =>
  toAmount * (1 - slippagePercent / 100);
