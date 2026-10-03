import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { DEFAULT_SETTINGS, parseStoredSettings, SETTINGS_STORAGE_KEY } from '@/lib/settings';
import type { AppSettings, FiatCurrency } from '@/types/wallet';

type SettingsContextValue = {
  settings: AppSettings;
  updateSettings: (changes: Partial<AppSettings>) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

/** Preferensi aplikasi, diingat di HP (bukan data rahasia, jadi cukup AsyncStorage). */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(SETTINGS_STORAGE_KEY)
      .then((raw) => {
        if (active && raw) setSettings(parseStoredSettings(raw));
      })
      .catch(() => {
        // Gagal baca = pakai bawaan.
      });
    return () => {
      active = false;
    };
  }, []);

  const updateSettings = useCallback((changes: Partial<AppSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...changes };
      AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next)).catch(() => {
        // Gagal simpan cukup berarti pilihan tidak diingat setelah app ditutup.
      });
      return next;
    });
  }, []);

  const value = useMemo(() => ({ settings, updateSettings }), [settings, updateSettings]);
  return <SettingsContext value={value}>{children}</SettingsContext>;
}

export function useSettings(): SettingsContextValue {
  const value = use(SettingsContext);
  if (!value) throw new Error('useSettings harus dipakai di dalam <SettingsProvider>');
  return value;
}

/** Mata uang pendamping USD di semua layar. */
export function useDisplayCurrency(): FiatCurrency {
  return useSettings().settings.displayCurrency;
}
