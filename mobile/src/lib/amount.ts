export type AmountCheck =
  | { status: 'empty' }
  | { status: 'invalid'; reason: 'format' | 'zero' | 'too_many_decimals' | 'insufficient' }
  | { status: 'valid'; amount: number };

/**
 * Normalisasi ketikan jumlah: terima koma ATAU titik sebagai desimal
 * (`12,5` = `12.5`). Kalau keduanya ada, tanda yang terakhir dianggap
 * desimal dan yang lain pemisah ribuan (`1.250,50` / `1,250.50`).
 */
export function normalizeAmountInput(input: string): string {
  const value = input.replace(/\s+/g, '');
  const lastComma = value.lastIndexOf(',');
  const lastDot = value.lastIndexOf('.');
  if (lastComma === -1) return value;
  if (lastDot === -1) return value.replace(',', '.');
  return lastComma > lastDot ? value.replace(/\./g, '').replace(',', '.') : value.replace(/,/g, '');
}

/** Batas desimal yang boleh diketik (maks 8 supaya tetap terbaca). */
export const maxInputDecimals = (tokenDecimals: number) => Math.min(tokenDecimals, 8);

export function checkAmount(input: string, balance: number, tokenDecimals: number): AmountCheck {
  const normalized = normalizeAmountInput(input);
  if (!normalized) return { status: 'empty' };
  if (!/^\d*\.?\d*$/.test(normalized) || normalized === '.') {
    return { status: 'invalid', reason: 'format' };
  }
  const decimals = normalized.split('.')[1]?.length ?? 0;
  if (decimals > maxInputDecimals(tokenDecimals)) {
    return { status: 'invalid', reason: 'too_many_decimals' };
  }
  const amount = Number(normalized);
  if (!(amount > 0)) return { status: 'invalid', reason: 'zero' };
  if (amount > balance + 1e-12) return { status: 'invalid', reason: 'insufficient' };
  return { status: 'valid', amount };
}

/**
 * Angka untuk diisi ke kolom (mis. tombol Maks): dibulatkan KE BAWAH supaya
 * tidak pernah melebihi saldo, tanpa pemisah ribuan.
 */
export function formatAmountForInput(value: number, decimals: number): string {
  const places = Math.min(decimals, 6);
  const factor = 10 ** places;
  const floored = Math.floor(Math.max(0, value) * factor + 1e-9) / factor;
  return floored.toFixed(places).replace(/\.?0+$/, '') || '0';
}
