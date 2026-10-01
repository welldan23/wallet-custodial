import { createContext, use, useState, type ReactNode } from 'react';

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

/** Bahasa default Indonesia; nanti bisa diganti dari halaman Pengaturan. */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('id');
  return (
    <I18nContext value={{ language, setLanguage, t: dictionaries[language] }}>
      {children}
    </I18nContext>
  );
}

export function useI18n() {
  const value = use(I18nContext);
  if (!value) throw new Error('useI18n harus dipakai di dalam <I18nProvider>');
  return value;
}
