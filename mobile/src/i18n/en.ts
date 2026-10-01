import type { Dictionary } from './id';

export const en: Dictionary = {
  tabs: {
    home: 'Home',
    history: 'Tracker',
    portfolio: 'Portfolio',
    profile: 'Profile',
  },
  common: {
    back: 'Back',
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
    emptyTitle: 'No assets yet',
    emptyDescription:
      'Your wallet is empty. Receive USDC or USDT from an exchange or a friend and your balance will show up here.',
    emptyCta: 'Receive Assets',
    supportedNetworks: 'Supported networks',
    emptyStablecoins: 'No stablecoins yet. Receive USDC or USDT to get started.',
    emptyGasCoins: 'No gas coins yet. You need ETH, POL, or SOL to pay network fees.',
    networkCount: (count: number) => `${count} ${count === 1 ? 'network' : 'networks'}`,
    showBreakdown: 'Show per-network breakdown',
    hideBreakdown: 'Hide per-network breakdown',
    holdingShare: (percent: string, symbol: string) => `${percent} of your ${symbol}`,
  },
  send: {
    title: 'Send',
    preview:
      'Soon you can send USDC or USDT to another address here, with look-alike address checks and fingerprint confirmation.',
  },
  receive: {
    title: 'Receive',
    preview: 'Soon your wallet address and QR code for each network will show up here.',
  },
  swap: {
    title: 'Swap',
    preview: 'Soon you can swap between stablecoins here, with clear rates, slippage, and fees.',
  },
};
