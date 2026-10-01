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
    assetLabel: 'Choose asset',
    changeAssetLabel: (symbol: string, network: string) =>
      `Asset: ${symbol} on ${network}. Tap to change`,
    available: 'Available balance',
    pickAssetTitle: 'Choose Asset',
    searchAsset: 'Search asset or network',
    noAssetFound: 'No asset found.',
    noAssets: 'No assets to send yet. Receive some first.',
    recipientLabel: (network: string) => `To ${network} address`,
    solanaPlaceholder: 'Solana address',
    paste: 'Paste',
    pasteFailed: "Couldn't read the clipboard",
    clearAddress: 'Clear address',
    validAddress: (network: string) => `Valid ${network} address format.`,
    ownAddressWarning: 'This is your own wallet address. Sure you want to send to yourself?',
    invalidReason: {
      evm_format: (_network: string) =>
        'The address must be 0x followed by 40 characters (0-9, a-f).',
      evm_checksum: (_network: string) =>
        "The upper/lower case letters don't match. There may be a typo; copy the address again.",
      solana_on_evm: (network: string) =>
        `This is a Solana address, but the selected asset is on ${network}. Switch to a Solana asset.`,
      evm_on_solana: (_network: string) =>
        'This is an EVM (0x…) address, but the selected asset is on Solana. Switch to an EVM asset.',
      solana_format: (_network: string) => 'Not a valid Solana address.',
      tron: (_network: string) =>
        'This is a Tron (TRC20) address; MyWallet does not support that network yet.',
      bitcoin: (_network: string) =>
        'This is a Bitcoin address; MyWallet does not support that network yet.',
      unknown: (network: string) => `Not a valid ${network} address.`,
    },
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
    copyAddress: 'Copy address',
    copied: 'Copied',
    copiedTitle: (network: string) => `${network} address copied`,
    copiedMessage: (short: string) =>
      `${short} — check the start and end of the address after pasting.`,
    copyFailedTitle: "Couldn't copy",
    copyFailedMessage: 'Long-press the address to copy it manually.',
    enlargeQr: 'Enlarge QR',
    enlargeQrLabel: (network: string) => `Enlarge QR code of the ${network} address`,
    networkOnly: (network: string) => `${network} network only`,
    share: 'Share',
    shareTitle: (network: string) => `MyWallet ${network} address`,
    shareMessage: (network: string, symbols: string, address: string) =>
      `My wallet address on the ${network} network (${symbols}):\n${address}\n\nSend ONLY on the ${network} network; assets sent on another network may be lost.`,
    shareFallbackTitle: 'Address copied',
    shareFallbackMessage: 'Sharing is not available here, so the address was copied.',
    warningTitle: (network: string) => `Send only on the ${network} network`,
    warningExchangeLabel: 'When sending from an exchange, choose the network:',
    warningUnsupported: (networks: string) =>
      `Do not choose ${networks}, or any other network. Assets sent that way won't arrive in MyWallet.`,
    warningAssets: (symbols: string, network: string) =>
      `On ${network}, MyWallet currently supports ${symbols}. Other assets won't show up.`,
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
