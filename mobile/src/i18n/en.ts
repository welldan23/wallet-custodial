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
    close: 'Close',
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
    emptyTitle: 'No assets yet',
    emptyDescription:
      'Your wallet is empty. Receive USDC or USDT from an exchange or a friend and your balance will show up here.',
    emptyCta: 'Receive Assets',
    supportedNetworks: 'Supported networks',
    emptyStablecoins: 'No stablecoins yet. Receive USDC or USDT to get started.',
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
    demoWarning:
      'Demo mode: the address below is only an example and nobody holds its keys. Do not send real assets here.',
    chooseNetworkTitle: 'Which network will you receive on?',
    chooseNetworkSubtitle: 'Pick the same network the sender uses.',
    networkLabel: 'Network',
    supportedAssets: (symbols: string) => `Accepts ${symbols}`,
    addressTitle: (network: string) => `Your ${network} address`,
    qrLabel: (network: string) => `QR code of your ${network} address`,
    qrCaption: (network: string) => `Scan to send on the ${network} network`,
    sharedEvmAddressNote:
      'This address is the same on Ethereum, Arbitrum, Base, and Polygon, but balances are separate per network.',
  },
  swap: {
    title: 'Swap',
    preview: 'Soon you can swap between stablecoins here, with clear rates, slippage, and fees.',
  },
  gas: {
    title: 'Gas Balance',
    subtitle: 'Pays network fees on each chain',
    status: {
      ok: 'Enough',
      low: 'Low',
      empty: 'Empty',
    },
    txEstimate: (count: number) => `~${count} ${count === 1 ? 'transaction' : 'transactions'}`,
    manyTx: '100+ transactions',
    lessThanOneTx: '<1 transaction',
    topUp: 'Top up',
    topUpLabel: (network: string) => `Top up gas on ${network}`,
    warningNamed: (networks: string) =>
      `Top up gas on ${networks} so transactions there don't fail.`,
    warningCount: (count: number) => `${count} networks need gas so transactions don't fail.`,
    estimateNote: 'Estimate based on the fee for one stablecoin transfer.',
  },
  networkPicker: {
    title: 'Choose Network',
    moreLabel: (count: number) => `See ${count} more networks`,
  },
};
