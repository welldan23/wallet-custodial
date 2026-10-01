import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'mywallet:balance-hidden';

type BalanceVisibility = {
  /** `true` = semua angka saldo diganti titik-titik. */
  hidden: boolean;
  toggleHidden: () => void;
};

const BalanceVisibilityContext = createContext<BalanceVisibility | null>(null);

/**
 * Menyimpan pilihan "sembunyikan saldo" untuk semua halaman, dan
 * mengingatnya di HP supaya tetap tersembunyi saat app dibuka lagi.
 */
export function BalanceVisibilityProvider({ children }: { children: ReactNode }) {
  // `null` = pilihan tersimpan belum terbaca. Selama itu angka tetap
  // disamarkan, supaya saldo tidak sempat "berkedip" tampil di tempat umum.
  const [hidden, setHidden] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => setHidden((current) => current ?? value === 'true'))
      .catch(() => setHidden((current) => current ?? false));
  }, []);

  const toggleHidden = () => {
    const next = !(hidden ?? true);
    setHidden(next);
    AsyncStorage.setItem(STORAGE_KEY, String(next)).catch(() => {
      // Gagal simpan cukup berarti pilihan tidak diingat; tampilan tetap jalan.
    });
  };

  return (
    <BalanceVisibilityContext value={{ hidden: hidden ?? true, toggleHidden }}>
      {children}
    </BalanceVisibilityContext>
  );
}

export function useBalanceVisibility() {
  const value = use(BalanceVisibilityContext);
  if (!value) {
    throw new Error('useBalanceVisibility harus dipakai di dalam <BalanceVisibilityProvider>');
  }
  return value;
}
