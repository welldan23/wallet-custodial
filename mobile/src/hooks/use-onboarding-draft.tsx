import { createContext, use, useState, type ReactNode } from 'react';

type OnboardingDraft = {
  /** 12 kata yang sedang dibuat/diimpor; `null` = belum ada. */
  mnemonic: string[] | null;
  setMnemonic: (words: string[] | null) => void;
};

const OnboardingDraftContext = createContext<OnboardingDraft | null>(null);

/**
 * Wadah sementara untuk frasa selama alur onboarding. Sengaja hanya di
 * memori (bukan URL, bukan storage): hilang begitu alur onboarding ditutup.
 * Penyimpanan permanen nanti lewat secure store terkunci biometrik.
 */
export function OnboardingDraftProvider({ children }: { children: ReactNode }) {
  const [mnemonic, setMnemonic] = useState<string[] | null>(null);
  return (
    <OnboardingDraftContext value={{ mnemonic, setMnemonic }}>{children}</OnboardingDraftContext>
  );
}

export function useOnboardingDraft() {
  const value = use(OnboardingDraftContext);
  if (!value) throw new Error('useOnboardingDraft harus di dalam <OnboardingDraftProvider>');
  return value;
}
