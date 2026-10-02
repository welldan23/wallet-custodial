import { MOCK_WALLET_ACCOUNTS } from '@/mocks/accounts';

import { useWallet } from './use-wallet';

/**
 * Alamat publik wallet pengguna. Kalau belum ada wallet tersimpan, pakai
 * alamat contoh (`isDemo: true`) supaya tampilan tetap bisa dicoba.
 */
export function useWalletAccounts() {
  const { accounts } = useWallet();
  return accounts ? { accounts, isDemo: false } : { accounts: MOCK_WALLET_ACCOUNTS, isDemo: true };
}
