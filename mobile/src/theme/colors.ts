import palette from './palette';

export type ColorScheme = 'light' | 'dark';

/** Palet satu tema + `white` yang selalu putih (ikon/teks di atas tombol berwarna). */
export type ThemeColors = typeof palette.light & { white: string };

export const lightColors: ThemeColors = { ...palette.light, white: '#FFFFFF' };
export const darkColors: ThemeColors = { ...palette.dark, white: '#FFFFFF' };

export const themeColors = (scheme: ColorScheme): ThemeColors =>
  scheme === 'dark' ? darkColors : lightColors;

/** Variabel CSS untuk class NativeWind (`--c-…`), per tema. */
export const themeCssVars = (scheme: ColorScheme): Record<string, string> =>
  palette.cssVars(scheme === 'dark' ? palette.dark : palette.light) as Record<string, string>;

/** Gradient tema: header teal (semua layar) dan lembaran konten (permukaan → kanvas). */
export const themeGradients = (colors: ThemeColors) =>
  ({
    header: [colors.teal[500], colors.teal[400], colors.teal[300]],
    sheet: [colors.surface, colors.canvas],
  }) as const;

/** Bayangan halus untuk kartu. */
export const cardShadow = { boxShadow: '0px 2px 12px rgba(15, 23, 42, 0.06)' } as const;
