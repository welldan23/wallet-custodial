/**
 * Katalog MVP: jaringan, token, dan harga awal.
 *
 * Alamat kontrak dicocokkan ke sumber resmi (Circle untuk USDC, Tether/USDT0
 * untuk USDT) dan bisa dicek ulang on-chain dengan `npm run verify:tokens`.
 * Jangan menebak alamat — satu karakter salah berarti token yang lain.
 */
import type { Network, Price, Token } from '../types.js';

export const MVP_NETWORKS: Network[] = [
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

const usdc = (networkId: string, contractAddress: string): Token => ({
  id: `usdc-${networkId}`,
  symbol: 'USDC',
  name: 'USD Coin',
  networkId,
  contractAddress,
  decimals: 6,
  isStablecoin: true,
  isVisible: true,
});

const usdt = (networkId: string, contractAddress: string): Token => ({
  id: `usdt-${networkId}`,
  symbol: 'USDT',
  name: 'Tether USD',
  networkId,
  contractAddress,
  decimals: 6,
  isStablecoin: true,
  isVisible: true,
});

const gasCoin = (symbol: string, name: string, networkId: string, decimals: number): Token => ({
  id: `${symbol.toLowerCase()}-${networkId}`,
  symbol,
  name,
  networkId,
  contractAddress: null,
  decimals,
  isStablecoin: false,
  isVisible: true,
});

export const MVP_TOKENS: Token[] = [
  // USDC native (Circle)
  usdc('ethereum', '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'),
  usdc('arbitrum', '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'),
  usdc('base', '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'),
  usdc('polygon', '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359'),
  usdc('solana', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
  // USDT (Ethereum & Solana native; Arbitrum & Polygon = USDT0, alamat tetap)
  usdt('ethereum', '0xdAC17F958D2ee523a2206206994597C13D831ec7'),
  usdt('arbitrum', '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9'),
  usdt('polygon', '0xc2132D05D31c914a87C6611C10748AEb04B58e8F'),
  usdt('solana', 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'),
  // Koin gas
  gasCoin('ETH', 'Ether', 'ethereum', 18),
  gasCoin('ETH', 'Ether', 'arbitrum', 18),
  gasCoin('ETH', 'Ether', 'base', 18),
  gasCoin('POL', 'Polygon', 'polygon', 18),
  gasCoin('SOL', 'Solana', 'solana', 9),
  // Di luar MVP → disembunyikan
  {
    id: 'dai-ethereum',
    symbol: 'DAI',
    name: 'Dai',
    networkId: 'ethereum',
    contractAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    decimals: 18,
    isStablecoin: true,
    isVisible: false,
  },
];

/**
 * Harga cadangan supaya API langsung bisa menghitung nilai USD sebelum
 * PriceService jalan. Hanya diisi kalau belum ada, dan ditandai kedaluwarsa.
 */
export const SEED_PRICES: Omit<Price, 'updatedAt'>[] = [
  { symbol: 'USDC', usdPrice: 1, idrRate: 17900 },
  { symbol: 'USDT', usdPrice: 1, idrRate: 17900 },
  { symbol: 'DAI', usdPrice: 1, idrRate: 17900 },
  { symbol: 'ETH', usdPrice: 2700, idrRate: 17900 },
  { symbol: 'POL', usdPrice: 0.11, idrRate: 17900 },
  { symbol: 'SOL', usdPrice: 120, idrRate: 17900 },
];
