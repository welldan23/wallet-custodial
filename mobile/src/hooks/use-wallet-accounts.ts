import { MOCK_WALLET_ACCOUNTS } from '@/mocks/accounts';

/**
 * Alamat publik wallet pengguna. Sementara alamat contoh (`isDemo: true`);
 * nanti diturunkan dari frasa di secure store lewat modul kunci.
 */
export function useWalletAccounts() {
  return { accounts: MOCK_WALLET_ACCOUNTS, isDemo: true };
}
