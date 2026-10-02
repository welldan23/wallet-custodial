import { createContext, use, useEffect, useState, type ReactNode } from 'react';

import { useI18n } from '@/i18n';
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

  useEffect(() => {
    let active = true;
    storage
      .loadAccounts()
      .catch(() => null)
      .then((loaded) => {
        if (!active) return;
        setAccounts(loaded);
        setStatus(loaded ? 'ready' : 'none');
      });
    return () => {
      active = false;
    };
  }, [storage]);

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
    },
  };

  return <WalletContext value={value}>{children}</WalletContext>;
}

export function useWallet() {
  const value = use(WalletContext);
  if (!value) throw new Error('useWallet harus dipakai di dalam <WalletProvider>');
  return value;
}
