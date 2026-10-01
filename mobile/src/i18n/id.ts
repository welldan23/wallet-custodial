export const id = {
  tabs: {
    home: 'Home',
    history: 'Tracker',
    portfolio: 'Portfolio',
    profile: 'Profile',
  },
  common: {
    seeAll: 'Lihat Semua',
    comingSoon: 'Segera hadir',
    comingSoonDescription: 'Halaman ini lagi disiapin. Tunggu di update berikutnya, ya!',
  },
  home: {
    totalBalance: 'Total Saldo (USD)',
    hideBalance: 'Sembunyikan saldo',
    balanceDetail: 'Lihat rincian saldo di Portfolio',
    showBalance: 'Tampilkan saldo',
    fxRate: (rate: string) => `Kurs 1 USD ≈ ${rate}`,
    updatedAt: (time: string) => `diperbarui ${time}`,
    totalBalanceLabel: (usd: string, fiat?: string) =>
      fiat ? `Total saldo ${usd}, sekitar ${fiat}` : `Total saldo ${usd}`,
    balanceHiddenLabel: 'Total saldo disembunyikan',
    actions: {
      send: 'Kirim',
      receive: 'Terima',
      swap: 'Swap',
    },
    stablecoinAssets: 'Aset Stablecoin',
    gasCoins: 'Koin Gas',
    gasCoinsHint: 'Buat bayar biaya jaringan',
    emptyTitle: 'Belum ada aset',
    emptyDescription:
      'Wallet kamu masih kosong. Terima USDC atau USDT dari exchange atau teman, nanti saldonya muncul di sini.',
    emptyCta: 'Terima Aset',
    supportedNetworks: 'Jaringan yang didukung',
    emptyStablecoins: 'Belum ada stablecoin. Terima USDC atau USDT buat mulai.',
    emptyGasCoins: 'Belum ada koin gas. Kamu butuh ETH, POL, atau SOL buat bayar biaya jaringan.',
    networkCount: (count: number) => `${count} jaringan`,
    showBreakdown: 'Lihat rincian per jaringan',
    hideBreakdown: 'Tutup rincian per jaringan',
    holdingShare: (percent: string, symbol: string) => `${percent} dari total ${symbol}`,
  },
};

export type Dictionary = typeof id;
