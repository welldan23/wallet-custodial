/**
 * DATA TIRUAN — dipakai selama frontend dibangun duluan.
 * Bentuknya meniru kontrak API backend (networks, tokens, prices) dan
 * saldo dari RPC, jadi nanti tinggal diganti sumber datanya.
 */
import type { FxRates, Network, Price, Token, TokenBalance } from '@/types/wallet';

export const MOCK_NETWORKS: Network[] = [
  {
    id: 'ethereum',
    name: 'Ethereum',
    chainId: '1',
    chainType: 'evm',
    nativeSymbol: 'ETH',
    explorerUrl: 'https://etherscan.io',
    isActive: true,
  },
  {
    id: 'arbitrum',
    name: 'Arbitrum',
    chainId: '42161',
    chainType: 'evm',
    nativeSymbol: 'ETH',
    explorerUrl: 'https://arbiscan.io',
    isActive: true,
  },
  {
    id: 'base',
    name: 'Base',
    chainId: '8453',
    chainType: 'evm',
    nativeSymbol: 'ETH',
    explorerUrl: 'https://basescan.org',
    isActive: true,
  },
  {
    id: 'polygon',
    name: 'Polygon',
    chainId: '137',
    chainType: 'evm',
    nativeSymbol: 'POL',
    explorerUrl: 'https://polygonscan.com',
    isActive: true,
  },
  {
    id: 'solana',
    name: 'Solana',
    chainId: 'mainnet-beta',
    chainType: 'solana',
    nativeSymbol: 'SOL',
    explorerUrl: 'https://solscan.io',
    isActive: true,
  },
];

export const MOCK_TOKENS: Token[] = [
  // Stablecoin MVP
  {
    id: 'usdc-ethereum',
    symbol: 'USDC',
    name: 'USD Coin',
    networkId: 'ethereum',
    decimals: 6,
    isStablecoin: true,
    isVisible: true,
  },
  {
    id: 'usdc-arbitrum',
    symbol: 'USDC',
    name: 'USD Coin',
    networkId: 'arbitrum',
    decimals: 6,
    isStablecoin: true,
    isVisible: true,
  },
  {
    id: 'usdc-base',
    symbol: 'USDC',
    name: 'USD Coin',
    networkId: 'base',
    decimals: 6,
    isStablecoin: true,
    isVisible: true,
  },
  {
    id: 'usdc-polygon',
    symbol: 'USDC',
    name: 'USD Coin',
    networkId: 'polygon',
    decimals: 6,
    isStablecoin: true,
    isVisible: true,
  },
  {
    id: 'usdc-solana',
    symbol: 'USDC',
    name: 'USD Coin',
    networkId: 'solana',
    decimals: 6,
    isStablecoin: true,
    isVisible: true,
  },
  {
    id: 'usdt-ethereum',
    symbol: 'USDT',
    name: 'Tether USD',
    networkId: 'ethereum',
    decimals: 6,
    isStablecoin: true,
    isVisible: true,
  },
  {
    id: 'usdt-arbitrum',
    symbol: 'USDT',
    name: 'Tether USD',
    networkId: 'arbitrum',
    decimals: 6,
    isStablecoin: true,
    isVisible: true,
  },
  {
    id: 'usdt-polygon',
    symbol: 'USDT',
    name: 'Tether USD',
    networkId: 'polygon',
    decimals: 6,
    isStablecoin: true,
    isVisible: true,
  },
  {
    id: 'usdt-solana',
    symbol: 'USDT',
    name: 'Tether USD',
    networkId: 'solana',
    decimals: 6,
    isStablecoin: true,
    isVisible: true,
  },
  // Koin gas
  {
    id: 'eth-ethereum',
    symbol: 'ETH',
    name: 'Ether',
    networkId: 'ethereum',
    decimals: 18,
    isStablecoin: false,
    isVisible: true,
  },
  {
    id: 'eth-arbitrum',
    symbol: 'ETH',
    name: 'Ether',
    networkId: 'arbitrum',
    decimals: 18,
    isStablecoin: false,
    isVisible: true,
  },
  {
    id: 'eth-base',
    symbol: 'ETH',
    name: 'Ether',
    networkId: 'base',
    decimals: 18,
    isStablecoin: false,
    isVisible: true,
  },
  {
    id: 'pol-polygon',
    symbol: 'POL',
    name: 'Polygon',
    networkId: 'polygon',
    decimals: 18,
    isStablecoin: false,
    isVisible: true,
  },
  {
    id: 'sol-solana',
    symbol: 'SOL',
    name: 'Solana',
    networkId: 'solana',
    decimals: 9,
    isStablecoin: false,
    isVisible: true,
  },
  // Di luar MVP → disembunyikan, tidak ikut dihitung di Home
  {
    id: 'dai-ethereum',
    symbol: 'DAI',
    name: 'Dai',
    networkId: 'ethereum',
    decimals: 18,
    isStablecoin: true,
    isVisible: false,
  },
];

const MOCK_UPDATED_AT = '2026-10-01T10:42:00.000Z';

export const MOCK_PRICES: Price[] = [
  { symbol: 'USDC', usdPrice: 0.9999, updatedAt: MOCK_UPDATED_AT },
  { symbol: 'USDT', usdPrice: 1.0002, updatedAt: MOCK_UPDATED_AT },
  { symbol: 'DAI', usdPrice: 1, updatedAt: MOCK_UPDATED_AT },
  { symbol: 'ETH', usdPrice: 2980.5, updatedAt: MOCK_UPDATED_AT },
  { symbol: 'POL', usdPrice: 0.42, updatedAt: MOCK_UPDATED_AT },
  { symbol: 'SOL', usdPrice: 152.3, updatedAt: MOCK_UPDATED_AT },
];

export const MOCK_FX_RATES: FxRates = {
  USD: 1,
  IDR: 16350,
};

export const MOCK_BALANCES: TokenBalance[] = [
  { tokenId: 'usdc-arbitrum', amount: 520 },
  { tokenId: 'usdc-base', amount: 350 },
  { tokenId: 'usdc-ethereum', amount: 180 },
  { tokenId: 'usdc-polygon', amount: 100 },
  { tokenId: 'usdc-solana', amount: 100 },
  { tokenId: 'usdt-ethereum', amount: 150 },
  { tokenId: 'usdt-polygon', amount: 130 },
  { tokenId: 'usdt-arbitrum', amount: 120 },
  { tokenId: 'usdt-solana', amount: 100 },
  { tokenId: 'eth-ethereum', amount: 0.0421 },
  { tokenId: 'eth-arbitrum', amount: 0.0185 },
  { tokenId: 'eth-base', amount: 0.0094 },
  { tokenId: 'pol-polygon', amount: 12.5 },
  { tokenId: 'sol-solana', amount: 0.215 },
  { tokenId: 'dai-ethereum', amount: 25 },
];

/**
 * Skenario saldo tiruan untuk ngetes tampilan, dipilih lewat env
 * `EXPO_PUBLIC_MOCK_WALLET`, mis. `EXPO_PUBLIC_MOCK_WALLET=empty npx expo start`.
 * - `funded` (default): ada stablecoin & koin gas
 * - `empty`: wallet baru, belum ada aset sama sekali
 * - `no-gas`: cuma punya stablecoin, belum punya koin gas
 */
export type MockWalletScenario = 'funded' | 'empty' | 'no-gas';

const isStablecoinBalance = (balance: TokenBalance) =>
  MOCK_TOKENS.find((token) => token.id === balance.tokenId)?.isStablecoin ?? false;

const MOCK_SCENARIO_BALANCES: Record<MockWalletScenario, TokenBalance[]> = {
  funded: MOCK_BALANCES,
  empty: [],
  'no-gas': MOCK_BALANCES.filter(isStablecoinBalance),
};

export function getMockBalances(
  scenario: string | undefined = process.env.EXPO_PUBLIC_MOCK_WALLET,
): TokenBalance[] {
  return MOCK_SCENARIO_BALANCES[scenario as MockWalletScenario] ?? MOCK_BALANCES;
}
