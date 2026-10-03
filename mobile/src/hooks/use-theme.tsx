import { vars } from 'nativewind';
import { createContext, use, useEffect, useMemo, type ReactNode } from 'react';
import { Platform, useColorScheme, View } from 'react-native';

import { useSettings } from '@/hooks/use-settings';
import { themeColors, themeCssVars, type ColorScheme, type ThemeColors } from '@/theme/colors';

type ThemeContextValue = {
  /** Tema yang sedang tampil (pilihan "Sistem" sudah diterjemahkan). */
  scheme: ColorScheme;
  colors: ThemeColors;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Pasang tema dari Pengaturan: Terang, Gelap, atau ikuti HP. Warna class
 * NativeWind diganti lewat variabel CSS di View paling luar; komponen yang
 * butuh warna di kode (ikon, gradient) memakai `useThemeColors()`.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const system = useColorScheme();
  const scheme: ColorScheme =
    settings.theme === 'system' ? (system === 'dark' ? 'dark' : 'light') : settings.theme;

  const cssVars = useMemo(() => themeCssVars(scheme), [scheme]);
  const value = useMemo(() => ({ scheme, colors: themeColors(scheme) }), [scheme]);

  // Di web, lembar/modal dirender di luar View ini (portal), jadi variabelnya
  // juga dipasang di <html>.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const root = document.documentElement;
    for (const [name, rgb] of Object.entries(cssVars)) root.style.setProperty(name, rgb);
    root.style.colorScheme = scheme;
  }, [cssVars, scheme]);

  return (
    <ThemeContext value={value}>
      <View style={[{ flex: 1 }, vars(cssVars)]}>{children}</View>
    </ThemeContext>
  );
}

export function useTheme(): ThemeContextValue {
  const value = use(ThemeContext);
  if (!value) throw new Error('useTheme harus dipakai di dalam <ThemeProvider>');
  return value;
}

/** Warna tema aktif untuk ikon, gradient, dan style di kode. */
export function useThemeColors(): ThemeColors {
  return useTheme().colors;
}
