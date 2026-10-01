import type { Network, Price, Token, TokenBalance } from '@/types/wallet';

export type AssetHolding = {
  network: Network;
  amount: number;
  valueUsd: number;
};

/** Satu aset (mis. USDC) yang sudah digabung dari semua jaringan. */
export type PortfolioAsset = {
  symbol: string;
  name: string;
  isStablecoin: boolean;
  amount: number;
  valueUsd: number;
  /** Rincian per jaringan, urut dari nilai terbesar. */
  holdings: AssetHolding[];
};

export type Portfolio = {
  totalUsd: number;
  stablecoins: PortfolioAsset[];
  gasCoins: PortfolioAsset[];
};

type PortfolioInput = {
  networks: Network[];
  tokens: Token[];
  prices: Price[];
  balances: TokenBalance[];
};

const byValueDesc = <T extends { valueUsd: number }>(a: T, b: T) => b.valueUsd - a.valueUsd;

/**
 * Gabungkan saldo per token-per-jaringan menjadi daftar aset untuk Home.
 * Token tersembunyi (`isVisible: false`), jaringan nonaktif, dan saldo nol
 * tidak ikut ditampilkan maupun dihitung ke total.
 */
export function buildPortfolio({ networks, tokens, prices, balances }: PortfolioInput): Portfolio {
  const networkById = new Map(networks.filter((n) => n.isActive).map((n) => [n.id, n]));
  const tokenById = new Map(tokens.filter((t) => t.isVisible).map((t) => [t.id, t]));
  const priceBySymbol = new Map(prices.map((p) => [p.symbol, p.usdPrice]));
  const assets = new Map<string, PortfolioAsset>();

  for (const { tokenId, amount } of balances) {
    const token = tokenById.get(tokenId);
    const network = token && networkById.get(token.networkId);
    if (!token || !network || amount <= 0) continue;

    const valueUsd = amount * (priceBySymbol.get(token.symbol) ?? 0);
    const asset = assets.get(token.symbol) ?? {
      symbol: token.symbol,
      name: token.name,
      isStablecoin: token.isStablecoin,
      amount: 0,
      valueUsd: 0,
      holdings: [],
    };
    asset.amount += amount;
    asset.valueUsd += valueUsd;
    asset.holdings.push({ network, amount, valueUsd });
    assets.set(token.symbol, asset);
  }

  const all = [...assets.values()].sort(byValueDesc);
  for (const asset of all) asset.holdings.sort(byValueDesc);

  return {
    totalUsd: all.reduce((sum, asset) => sum + asset.valueUsd, 0),
    stablecoins: all.filter((asset) => asset.isStablecoin),
    gasCoins: all.filter((asset) => !asset.isStablecoin),
  };
}
