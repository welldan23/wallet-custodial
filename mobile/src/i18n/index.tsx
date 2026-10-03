import { createContext, use, useMemo, type ReactNode } from 'react';

import { useSettings } from '@/hooks/use-settings';

import { en } from './en';
import { id, type Dictionary } from './id';

export type Language = 'id' | 'en';

const dictionaries: Record<Language, Dictionary> = { id, en };

type I18nContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Dictionary;
};

const I18nContext = createContext<I18nContextValue | null>(null);

/** Bahasa dari Pengaturan (bawaan Indonesia); harus di dalam `SettingsProvider`. */
export function I18nProvider({ children }: { children: ReactNode }) {
  const { settings, updateSettings } = useSettings();
  const language = settings.language;
  const value = useMemo(
    () => ({
      language,
      setLanguage: (next: Language) => updateSettings({ language: next }),
      t: dictionaries[language],
    }),
    [language, updateSettings],
  );
  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n() {
  const value = use(I18nContext);
  if (!value) throw new Error('useI18n harus dipakai di dalam <I18nProvider>');
  return value;
}
