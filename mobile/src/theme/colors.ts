import palette from './palette';

/** Palet yang sama dengan class Tailwind — pakai ini untuk ikon & gradient. */
export const colors = palette;

/** Gradient latar atas halaman (mint → kanvas). */
export const screenGradient = [colors.mint[300], colors.mint[100], colors.canvas] as const;

/** Gradient kartu Total Saldo (hijau gelap). */
export const balanceCardGradient = [
  colors.brand[500],
  colors.brand[700],
  colors.brand[900],
] as const;

/** Bayangan halus untuk kartu putih di atas latar kanvas. */
export const cardShadow = { boxShadow: '0px 6px 18px rgba(14, 27, 23, 0.06)' } as const;
