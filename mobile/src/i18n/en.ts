import type { Dictionary } from './id';

export const en: Dictionary = {
  tabs: {
    home: 'Home',
    history: 'History',
    profile: 'Profile',
  },
  common: {
    seeAll: 'See All',
    comingSoon: 'Coming soon',
    comingSoonDescription: 'This page is being prepared. Stay tuned for the next update!',
  },
  home: {
    walletName: 'MyWallet',
    walletSubtitle: 'Stablecoin • Multi Chain',
    support: 'Support',
    notifications: 'Notifications',
    totalBalance: 'Total Balance (USD)',
    hideBalance: 'Hide balance',
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
  },
};
