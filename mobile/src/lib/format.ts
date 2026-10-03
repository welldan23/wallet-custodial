import type { FiatCurrency, FxRates } from '@/types/wallet';

/** Gaya angka mengikuti bahasa: `id` = 1.234,56 · `en` = 1,234.56. */
export type NumberLocale = 'id' | 'en';

/** Pemisah ribuan & desimal per bahasa. */
export function numberSeparators(locale: NumberLocale) {
  return locale === 'id'
    ? { thousandSeparator: '.', decimalSeparator: ',' }
    : { thousandSeparator: ',', decimalSeparator: '.' };
}

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

/** `2481.92` → `"2,481.92"` (`id`: `"2.481,92"`), tanpa simbol, untuk kartu saldo. */
export function formatUsdNumber(value: number, locale: NumberLocale = 'en'): string {
  return formatNumber(value, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...numberSeparators(locale),
  });
}

/** `2481.92` → `"$2,481.92"` (`id`: `"$2.481,92"`). */
export function formatUsd(value: number, locale: NumberLocale = 'en'): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}$${formatUsdNumber(Math.abs(value), locale)}`;
}

/**
 * `38762410` → `"Rp 38.762.410"` (Rupiah tanpa desimal). Tanpa `locale`,
 * pemisahnya titik seperti kebiasaan Rupiah; `en` → `"Rp 38,762,410"`.
 */
export function formatIdr(value: number, locale: NumberLocale = 'id'): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}Rp ${formatNumber(Math.abs(value), {
    maximumFractionDigits: 0,
    ...numberSeparators(locale),
  })}`;
}

/** Ubah nilai USD ke mata uang tampilan lalu format. */
export function formatFiat(
  valueUsd: number,
  currency: FiatCurrency,
  rates: FxRates,
  locale?: NumberLocale,
): string {
  const value = valueUsd * rates[currency];
  return currency === 'IDR' ? formatIdr(value, locale) : formatUsd(value, locale);
}

/**
 * Jumlah token: stablecoin selalu 2 desimal (`1,250.00`); koin gas
 * pakai desimal lebih banyak supaya saldo kecil tetap kebaca (`0.0421`).
 */
export function formatTokenAmount(
  amount: number,
  isStablecoin: boolean,
  locale: NumberLocale = 'en',
): string {
  const separators = numberSeparators(locale);
  if (isStablecoin) {
    return formatNumber(amount, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      ...separators,
    });
  }
  return formatNumber(amount, {
    minimumFractionDigits: 2,
    maximumFractionDigits: amount !== 0 && Math.abs(amount) < 1 ? 6 : 4,
    ...separators,
  });
}

/** Waktu ISO → jam lokal HP, mis. `"10:42"`. */
export function formatTime(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Rasio 0–1 → persen, mis. `0.416` → `"42%"`; porsi sangat kecil jadi `"<1%"`. */
export function formatPercent(ratio: number): string {
  if (ratio > 0 && ratio < 0.01) return '<1%';
  return `${Math.round(ratio * 100)}%`;
}

/** Semua formatter dengan bahasa yang sudah dipasang, untuk `useFormat()`. */
export function createFormatter(locale: NumberLocale) {
  const separators = numberSeparators(locale);
  return {
    locale,
    formatNumber: (value: number, options: NumberFormatOptions = {}) =>
      formatNumber(value, { ...separators, ...options }),
    formatUsdNumber: (value: number) => formatUsdNumber(value, locale),
    formatUsd: (value: number) => formatUsd(value, locale),
    formatIdr: (value: number) => formatIdr(value, locale),
    formatFiat: (valueUsd: number, currency: FiatCurrency, rates: FxRates) =>
      formatFiat(valueUsd, currency, rates, locale),
    formatTokenAmount: (amount: number, isStablecoin: boolean) =>
      formatTokenAmount(amount, isStablecoin, locale),
    formatTime,
    formatPercent,
  };
}

export type Formatter = ReturnType<typeof createFormatter>;
