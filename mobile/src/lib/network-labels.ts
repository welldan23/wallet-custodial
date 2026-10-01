import type { NetworkId } from '@/types/wallet';

/**
 * Nama jaringan seperti yang tertulis di exchange (Indodax, Tokocrypto,
 * Binance, dll). Pengirim sering salah pilih karena label exchange beda
 * dengan nama jaringan.
 */
export const EXCHANGE_NETWORK_LABELS: Record<NetworkId, string> = {
  ethereum: 'ERC20 (Ethereum)',
  arbitrum: 'Arbitrum One',
  base: 'Base',
  polygon: 'Polygon PoS',
  solana: 'Solana (SPL)',
};

/** Jaringan populer di exchange yang BELUM didukung MyWallet. */
export const COMMON_UNSUPPORTED_NETWORKS = [
  'TRC20 (Tron)',
  'BEP20 (BNB Smart Chain)',
  'Optimism',
  'Avalanche C-Chain',
  'TON',
] as const;
