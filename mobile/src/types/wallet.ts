export type ChainType = 'evm' | 'solana';

export type NetworkId = 'ethereum' | 'arbitrum' | 'base' | 'polygon' | 'solana';

/** Jaringan yang didukung — sama dengan tabel `networks` di PRD. */
export type Network = {
  id: NetworkId;
  name: string;
  chainId: string;
  chainType: ChainType;
  nativeSymbol: string;
  explorerUrl: string;
  isActive: boolean;
};

/**
 * Token di satu jaringan — sama dengan tabel `tokens` di PRD.
 * `contractAddress` belum dipakai di frontend; nanti datang dari backend.
 */
export type Token = {
  id: string;
  symbol: string;
  name: string;
  networkId: NetworkId;
  decimals: number;
  isStablecoin: boolean;
  /** Token non-MVP disembunyikan supaya tampilan tetap rapi. */
  isVisible: boolean;
};

/** Harga terbaru satu simbol dalam USD — tabel `prices` di PRD. */
export type Price = {
  symbol: string;
  usdPrice: number;
  updatedAt: string;
};

/** Mata uang tampilan selain USD. */
export type FiatCurrency = 'IDR' | 'USD';

/** Kurs 1 USD → mata uang tampilan. */
export type FxRates = Record<FiatCurrency, number>;

/** Saldo satu token di satu jaringan (nanti dibaca langsung dari RPC). */
export type TokenBalance = {
  tokenId: string;
  amount: number;
};

/**
 * Alamat publik wallet. Satu alamat EVM dipakai di semua jaringan EVM
 * (Ethereum, Arbitrum, Base, Polygon), plus satu alamat Solana.
 */
export type WalletAccounts = {
  evm: string;
  solana: string;
};

/** Kontak di Buku Alamat — tabel `contacts` di PRD. */
export type Contact = {
  id: string;
  name: string;
  address: string;
  /** Jaringan yang biasa dipakai; `null` = semua jaringan bertipe sama. */
  networkId: NetworkId | null;
  isFavorite: boolean;
};

/** Preferensi aplikasi — tabel `settings` di PRD. */
export type AppSettings = {
  displayCurrency: FiatCurrency;
  language: 'id' | 'en';
  theme: 'light' | 'dark' | 'system';
  /** Kunci otomatis setelah sekian menit di background; `0` = langsung. */
  autoLockMinutes: number;
  /** Minta sidik jari/Face ID sebelum tanda tangan transaksi. */
  biometricSigning: boolean;
};
