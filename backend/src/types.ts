export type ChainType = 'evm' | 'solana';

/** Jaringan yang didukung — tabel `networks` di PRD. */
export type Network = {
  /** Mis. "ethereum", "arbitrum", "solana". Sama dengan id di aplikasi mobile. */
  id: string;
  name: string;
  chainId: string;
  chainType: ChainType;
  nativeSymbol: string;
  explorerUrl: string;
  isActive: boolean;
};

/** Token di satu jaringan — tabel `tokens` di PRD. */
export type Token = {
  id: string;
  symbol: string;
  name: string;
  networkId: string;
  /** Alamat kontrak (EVM) atau mint (Solana). `null` = koin gas bawaan jaringan. */
  contractAddress: string | null;
  decimals: number;
  isStablecoin: boolean;
  /** Token non-MVP disembunyikan dan tidak ikut dihitung. */
  isVisible: boolean;
};

/** Harga terakhir satu simbol — tabel `prices` di PRD. */
export type Price = {
  symbol: string;
  usdPrice: number;
  /** Kurs 1 USD → Rupiah saat harga ini dicatat. */
  idrRate: number;
  updatedAt: string;
};
