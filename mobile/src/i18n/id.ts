export const id = {
  tabs: {
    home: 'Home',
    history: 'Tracker',
    portfolio: 'Portfolio',
    profile: 'Profile',
  },
  common: {
    back: 'Kembali',
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
  send: {
    title: 'Kirim',
    preview:
      'Nanti di sini kamu bisa kirim USDC atau USDT ke alamat lain, lengkap dengan cek alamat mirip dan konfirmasi sidik jari.',
  },
  receive: {
    title: 'Terima',
    preview: 'Nanti di sini muncul alamat wallet dan QR code per jaringan buat nerima dana.',
  },
  swap: {
    title: 'Swap',
    preview:
      'Nanti di sini kamu bisa tukar antar stablecoin, lengkap dengan kurs, slippage, dan biaya yang jelas.',
  },
};

export type Dictionary = typeof id;
