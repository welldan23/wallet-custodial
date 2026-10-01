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

export type TransactionType = 'send' | 'receive' | 'swap';
export type TransactionStatus = 'pending' | 'success' | 'failed';

/** Satu baris tabel `transactions` (lihat migrasi 4 untuk beda dengan PRD). */
export type Transaction = {
  id: string;
  /** HMAC alamat pemilik — alamat wallet asli tidak disimpan. */
  walletKey: string;
  networkId: string;
  tokenId: string;
  type: TransactionType;
  status: TransactionStatus;
  /** Jumlah dalam satuan terkecil token, sebagai string. */
  amountRaw: string;
  amountUsd: number | null;
  /** Biaya jaringan dalam satuan terkecil koin gas; `null` kalau belum diketahui. */
  feeRaw: string | null;
  counterpartyAddress: string;
  txHash: string;
  createdAt: string;
  updatedAt: string;
};

export type SwapProvider = 'lifi' | 'jupiter';
export type BridgeStatus = 'pending' | 'done' | 'failed' | 'refunded';

/** Baris `swap_details` (1:1 dengan transaksi bertipe `swap`). */
export type SwapDetails = {
  transactionId: string;
  provider: SwapProvider;
  toNetworkId: string;
  toTokenId: string;
  /** Perkiraan jumlah diterima (satuan terkecil token tujuan). */
  quotedAmountRaw: string;
  /** Batas bawah setelah slippage; di bawah ini swap dibatalkan. */
  minAmountRaw: string;
  /** Jumlah yang benar-benar diterima; `null` sampai selesai. */
  receivedAmountRaw: string | null;
  slippageBps: number;
  bridgeStatus: BridgeStatus | null;
  destinationTxHash: string | null;
  quoteId: string | null;
};

export type SwapTransaction = Transaction & { swap: SwapDetails };
