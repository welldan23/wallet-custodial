import type { WalletAccounts } from '@/types/wallet';

/** Kunci penyimpanan. Frasa & alamat dipisah: alamat bukan rahasia. */
export const STORAGE_KEYS = {
  mnemonic: 'mywallet.mnemonic.v1',
  accounts: 'mywallet.accounts.v1',
} as const;

export type SecureStoreOptions = {
  requireAuthentication?: boolean;
  authenticationPrompt?: string;
  keychainAccessible?: number;
};

/** Bagian expo-secure-store yang dipakai (disuntik supaya bisa dites). */
export type SecureStoreLike = {
  setItemAsync(key: string, value: string, options?: SecureStoreOptions): Promise<void>;
  getItemAsync(key: string, options?: SecureStoreOptions): Promise<string | null>;
  deleteItemAsync(key: string, options?: SecureStoreOptions): Promise<void>;
  canUseBiometricAuthentication(): boolean;
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: number;
};

export type ReadMnemonicResult =
  | { status: 'ok'; words: string[] }
  /** Frasa tidak ada lagi — mis. kunci dibatalkan sistem karena biometrik HP diubah. */
  | { status: 'missing' }
  | { status: 'cancelled' };

export interface WalletStorage {
  /** `true` = frasa terikat biometrik oleh sistem (Keychain/Keystore). */
  readonly biometricBound: boolean;
  /** `false` = frasa hanya di memori (web/preview), hilang saat app ditutup. */
  readonly persistent: boolean;
  saveWallet(words: string[], accounts: WalletAccounts, prompt: string): Promise<void>;
  loadAccounts(): Promise<WalletAccounts | null>;
  readMnemonic(prompt: string): Promise<ReadMnemonicResult>;
  clearWallet(): Promise<void>;
}

const parseAccounts = (raw: string | null): WalletAccounts | null => {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<WalletAccounts>;
    return typeof value.evm === 'string' && typeof value.solana === 'string'
      ? { evm: value.evm, solana: value.solana }
      : null;
  } catch {
    return null;
  }
};

/**
 * Penyimpanan di HP (iOS Keychain / Android Keystore lewat expo-secure-store).
 * Frasa: hanya di perangkat ini (tidak ikut backup/pindah HP) dan — kalau
 * didukung — wajib biometrik untuk dibaca. `biometricBound: false` (mis. di
 * Expo Go) berarti gerbang biometrik dilakukan aplikasi sebelum membaca.
 */
export function createSecureWalletStorage(
  store: SecureStoreLike,
  { allowBiometricBinding }: { allowBiometricBinding: boolean },
): WalletStorage {
  const biometricBound = allowBiometricBinding && store.canUseBiometricAuthentication();
  const secretOptions = (prompt: string): SecureStoreOptions => ({
    keychainAccessible: store.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    ...(biometricBound ? { requireAuthentication: true, authenticationPrompt: prompt } : {}),
  });
  const plainOptions: SecureStoreOptions = {
    keychainAccessible: store.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  };

  return {
    biometricBound,
    persistent: true,
    async saveWallet(words, accounts, prompt) {
      await store.setItemAsync(STORAGE_KEYS.mnemonic, words.join(' '), secretOptions(prompt));
      await store.setItemAsync(STORAGE_KEYS.accounts, JSON.stringify(accounts), plainOptions);
    },
    async loadAccounts() {
      return parseAccounts(await store.getItemAsync(STORAGE_KEYS.accounts, plainOptions));
    },
    async readMnemonic(prompt) {
      let raw: string | null;
      try {
        raw = await store.getItemAsync(STORAGE_KEYS.mnemonic, secretOptions(prompt));
      } catch (error) {
        // Pengguna menutup prompt biometrik.
        if (/cancel/i.test(error instanceof Error ? error.message : ''))
          return { status: 'cancelled' };
        throw error;
      }
      return raw ? { status: 'ok', words: raw.split(' ') } : { status: 'missing' };
    },
    async clearWallet() {
      await store.deleteItemAsync(STORAGE_KEYS.mnemonic, plainOptions);
      await store.deleteItemAsync(STORAGE_KEYS.accounts, plainOptions);
    },
  };
}

/** Penyimpanan alamat publik yang tidak rahasia (AsyncStorage) — untuk web. */
export type KeyValueLike = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

/**
 * Web/preview: TIDAK ADA penyimpanan aman, jadi frasa hanya di memori dan
 * hilang saat halaman ditutup. Alamat publik boleh diingat di AsyncStorage.
 */
export function createMemoryWalletStorage(kv: KeyValueLike): WalletStorage {
  let words: string[] | null = null;
  return {
    biometricBound: false,
    persistent: false,
    async saveWallet(next, accounts) {
      words = [...next];
      await kv.setItem(STORAGE_KEYS.accounts, JSON.stringify(accounts));
    },
    async loadAccounts() {
      return parseAccounts(await kv.getItem(STORAGE_KEYS.accounts));
    },
    async readMnemonic() {
      return words ? { status: 'ok', words: [...words] } : { status: 'missing' };
    },
    async clearWallet() {
      words = null;
      await kv.removeItem(STORAGE_KEYS.accounts);
    },
  };
}
