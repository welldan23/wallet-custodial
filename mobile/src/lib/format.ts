import type { FiatCurrency, FxRates } from '@/types/wallet';

/** Pengganti angka saat saldo disembunyikan. */
export const MASKED_VALUE = '••••••';

type NumberFormatOptions = {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  thousandSeparator?: string;
  decimalSeparator?: string;
};

/**
 * Format angka tanpa bergantung pada Intl (hasilnya sama persis di
 * iOS, Android, dan web). Desimal ekstra di belakang dipangkas sampai
 * `minimumFractionDigits`.
 */
export function formatNumber(
  value: number,
  {
    minimumFractionDigits = 0,
    maximumFractionDigits = 2,
    thousandSeparator = ',',
    decimalSeparator = '.',
  }: NumberFormatOptions = {},
): string {
  const sign = value < 0 ? '-' : '';
  const [integer, fraction = ''] = Math.abs(value).toFixed(maximumFractionDigits).split('.');

  let trimmed = fraction;
  while (trimmed.length > minimumFractionDigits && trimmed.endsWith('0')) {
    trimmed = trimmed.slice(0, -1);
  }

  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSeparator);
  return sign + grouped + (trimmed ? decimalSeparator + trimmed : '');
}

/** `2481.92` → `"2,481.92"` (tanpa simbol, untuk angka besar di kartu saldo). */
export function formatUsdNumber(value: number): string {
  return formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** `2481.92` → `"$2,481.92"` */
export function formatUsd(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}$${formatUsdNumber(Math.abs(value))}`;
}

/** `38762410` → `"Rp 38.762.410"` (Rupiah tanpa desimal, pemisah titik). */
export function formatIdr(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}Rp ${formatNumber(Math.abs(value), {
    maximumFractionDigits: 0,
    thousandSeparator: '.',
    decimalSeparator: ',',
  })}`;
}

/** Ubah nilai USD ke mata uang tampilan lalu format. */
export function formatFiat(valueUsd: number, currency: FiatCurrency, rates: FxRates): string {
  const value = valueUsd * rates[currency];
  return currency === 'IDR' ? formatIdr(value) : formatUsd(value);
}

/**
 * Jumlah token: stablecoin selalu 2 desimal (`1,250.00`); koin gas
 * pakai desimal lebih banyak supaya saldo kecil tetap kebaca (`0.0421`).
 */
export function formatTokenAmount(amount: number, isStablecoin: boolean): string {
  if (isStablecoin) {
    return formatNumber(amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return formatNumber(amount, {
    minimumFractionDigits: 2,
    maximumFractionDigits: amount !== 0 && Math.abs(amount) < 1 ? 6 : 4,
  });
}
