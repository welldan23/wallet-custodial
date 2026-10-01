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
    emptyAssets: 'Belum ada aset di wallet ini.',
  },
};

export type Dictionary = typeof id;
