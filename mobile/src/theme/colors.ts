import palette from './palette';

/** Palet yang sama dengan class Tailwind — pakai ini untuk ikon & gradient. */
export const colors = palette;

/** Gradient teal di bagian atas layar (di belakang menu pil). */
export const headerGradient = [colors.teal[500], colors.teal[400], colors.teal[300]] as const;

/** Lembaran konten: putih di atas, memudar ke kanvas abu-abu muda. */
export const sheetGradient = [colors.surface, colors.canvas] as const;

/** Bayangan halus untuk kartu putih. */
export const cardShadow = { boxShadow: '0px 2px 12px rgba(15, 23, 42, 0.06)' } as const;
