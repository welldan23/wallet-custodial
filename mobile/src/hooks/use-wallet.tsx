import { createContext, use, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { useI18n } from '@/i18n';
import { shouldLockOnResume } from '@/lib/auto-lock';
import { deriveAddresses } from '@/lib/keys';
import type { ReadMnemonicResult, WalletStorage } from '@/lib/storage';
import { walletStorage } from '@/lib/wallet-storage';
import type { WalletAccounts } from '@/types/wallet';

export type WalletStatus = 'loading' | 'none' | 'ready';

type WalletState = {
  status: WalletStatus;
  /** Alamat wallet asli; `null` kalau belum ada wallet. */
  accounts: WalletAccounts | null;
  /** `false` = frasa hanya di memori (preview web). */
  persistent: boolean;
  biometricBound: boolean;
  /** Simpan wallet baru/impor: turunkan alamat, simpan aman, lalu aktif. */
  saveWallet: (words: string[]) => Promise<WalletAccounts>;
  /** Baca frasa (minta biometrik) — hanya untuk tanda tangan/ekspor. */
  readMnemonic: () => Promise<ReadMnemonicResult>;
  removeWallet: () => Promise<void>;
  /** Belum punya wallet tapi memilih melihat demo dulu (sesi ini saja). */
  demoMode: boolean;
  exploreDemo: () => void;
  /** `true` = tampilkan layar kunci (wallet ada, belum dibuka sesi ini). */
  locked: boolean;
  unlock: () => void;
};

const WalletContext = createContext<WalletState | null>(null);

/**
 * Status wallet di seluruh app. Saat start hanya alamat publik yang dibaca
 * (tanpa biometrik); frasa dibaca hanya ketika benar-benar perlu.
 */
export function WalletProvider({
  children,
  storage = walletStorage,
}: {
  children: ReactNode;
  storage?: WalletStorage;
}) {
  const { t } = useI18n();
  const [status, setStatus] = useState<WalletStatus>('loading');
  const [accounts, setAccounts] = useState<WalletAccounts | null>(null);
  const [locked, setLocked] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const backgroundAt = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    storage
      .loadAccounts()
      .catch(() => null)
      .then((loaded) => {
        if (!active) return;
        setAccounts(loaded);
        setStatus(loaded ? 'ready' : 'none');
        // Wallet lama dibuka lagi → wajib verifikasi dulu.
        setLocked(Boolean(loaded));
      });
    return () => {
      active = false;
    };
  }, [storage]);

  // Kunci lagi kalau app lama ditinggal di latar belakang.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') backgroundAt.current = Date.now();
      if (state === 'active') {
        if (shouldLockOnResume(backgroundAt.current, Date.now())) setLocked(true);
        backgroundAt.current = null;
      }
    });
    return () => subscription.remove();
  }, []);

  const value: WalletState = {
    status,
    accounts,
    persistent: storage.persistent,
    biometricBound: storage.biometricBound,
    async saveWallet(words) {
      const derived = deriveAddresses(words);
      await storage.saveWallet(words, derived, t.wallet.savePrompt);
      setAccounts(derived);
      setStatus('ready');
      return derived;
    },
    readMnemonic: () => storage.readMnemonic(t.wallet.unlockPrompt),
    async removeWallet() {
      await storage.clearWallet();
      setAccounts(null);
      setStatus('none');
      setLocked(false);
    },
    demoMode,
    exploreDemo: () => setDemoMode(true),
    locked: status === 'ready' && locked,
    unlock: () => setLocked(false),
  };

  return <WalletContext value={value}>{children}</WalletContext>;
}

export function useWallet() {
  const value = use(WalletContext);
  if (!value) throw new Error('useWallet harus dipakai di dalam <WalletProvider>');
  return value;
}
