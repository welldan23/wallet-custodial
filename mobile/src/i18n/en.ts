import type { Dictionary } from './id';

export const en: Dictionary = {
  tabs: {
    home: 'Home',
    history: 'Tracker',
    portfolio: 'Portfolio',
    profile: 'Profile',
  },
  common: {
    seeAll: 'See All',
    comingSoon: 'Coming soon',
    comingSoonDescription: 'This page is being prepared. Stay tuned for the next update!',
  },
  home: {
    totalBalance: 'Total Balance (USD)',
    hideBalance: 'Hide balance',
    balanceDetail: 'See balance details in Portfolio',
    showBalance: 'Show balance',
    fxRate: (rate: string) => `Rate 1 USD ≈ ${rate}`,
    updatedAt: (time: string) => `updated ${time}`,
    totalBalanceLabel: (usd: string, fiat?: string) =>
      fiat ? `Total balance ${usd}, about ${fiat}` : `Total balance ${usd}`,
    balanceHiddenLabel: 'Total balance hidden',
    actions: {
      send: 'Send',
      receive: 'Receive',
      swap: 'Swap',
    },
    stablecoinAssets: 'Stablecoin Assets',
    gasCoins: 'Gas Coins',
    gasCoinsHint: 'Used to pay network fees',
    emptyAssets: 'No assets in this wallet yet.',
    networkCount: (count: number) => `${count} ${count === 1 ? 'network' : 'networks'}`,
    showBreakdown: 'Show per-network breakdown',
    hideBreakdown: 'Hide per-network breakdown',
    holdingShare: (percent: string, symbol: string) => `${percent} of your ${symbol}`,
  },
};
