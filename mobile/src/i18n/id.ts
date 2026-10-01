export const id = {
  tabs: {
    home: 'Home',
    history: 'Tracker',
    portfolio: 'Portfolio',
    profile: 'Profile',
  },
  common: {
    back: 'Kembali',
    close: 'Tutup',
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
    emptyTitle: 'Belum ada aset',
    emptyDescription:
      'Wallet kamu masih kosong. Terima USDC atau USDT dari exchange atau teman, nanti saldonya muncul di sini.',
    emptyCta: 'Terima Aset',
    supportedNetworks: 'Jaringan yang didukung',
    emptyStablecoins: 'Belum ada stablecoin. Terima USDC atau USDT buat mulai.',
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
    demoWarning:
      'Mode demo: alamat di bawah cuma contoh dan nggak ada yang pegang kuncinya. Jangan kirim aset beneran ke sini.',
    chooseNetworkTitle: 'Mau terima di jaringan apa?',
    chooseNetworkSubtitle: 'Pilih jaringan yang sama dengan yang dipakai pengirim.',
    networkLabel: 'Jaringan',
    supportedAssets: (symbols: string) => `Bisa terima ${symbols}`,
    addressTitle: (network: string) => `Alamat ${network} kamu`,
    qrLabel: (network: string) => `QR code alamat ${network} kamu`,
    qrCaption: (network: string) => `Scan untuk kirim lewat jaringan ${network}`,
    copyAddress: 'Salin alamat',
    copied: 'Tersalin',
    copiedTitle: (network: string) => `Alamat ${network} disalin`,
    copiedMessage: (short: string) => `${short} — cocokkan awal & akhir alamat setelah ditempel.`,
    copyFailedTitle: 'Gagal menyalin',
    copyFailedMessage: 'Tekan lama alamatnya untuk menyalin manual.',
    enlargeQr: 'Perbesar QR',
    enlargeQrLabel: (network: string) => `Perbesar QR code alamat ${network}`,
    networkOnly: (network: string) => `Hanya jaringan ${network}`,
    share: 'Bagikan',
    shareTitle: (network: string) => `Alamat ${network} MyWallet`,
    shareMessage: (network: string, symbols: string, address: string) =>
      `Alamat wallet saya di jaringan ${network} (${symbols}):\n${address}\n\nKirim HANYA lewat jaringan ${network}, aset yang dikirim lewat jaringan lain bisa hilang.`,
    shareFallbackTitle: 'Alamat disalin',
    shareFallbackMessage: 'Menu bagikan tidak tersedia di sini, jadi alamatnya disalin.',
    warningTitle: (network: string) => `Kirim hanya lewat jaringan ${network}`,
    warningExchangeLabel: 'Kalau kirim dari exchange, pilih jaringan:',
    warningUnsupported: (networks: string) =>
      `Jangan pilih ${networks}, atau jaringan lain. Aset yang dikirim lewat jaringan itu nggak akan masuk ke MyWallet.`,
    warningAssets: (symbols: string, network: string) =>
      `Di ${network}, MyWallet baru mendukung ${symbols}. Aset lain nggak akan tampil.`,
    sharedEvmAddressNote:
      'Alamat ini sama di Ethereum, Arbitrum, Base, dan Polygon, tapi saldonya terpisah per jaringan.',
  },
  swap: {
    title: 'Swap',
    preview:
      'Nanti di sini kamu bisa tukar antar stablecoin, lengkap dengan kurs, slippage, dan biaya yang jelas.',
  },
  gas: {
    title: 'Saldo Gas',
    subtitle: 'Buat bayar biaya jaringan di tiap chain',
    status: {
      ok: 'Cukup',
      low: 'Menipis',
      empty: 'Kosong',
    },
    txEstimate: (count: number) => `±${count} transaksi`,
    manyTx: '100+ transaksi',
    lessThanOneTx: '<1 transaksi',
    topUp: 'Isi',
    topUpLabel: (network: string) => `Isi gas ${network}`,
    warningNamed: (networks: string) =>
      `Gas di ${networks} perlu diisi biar transaksi di sana nggak gagal.`,
    warningCount: (count: number) =>
      `${count} jaringan perlu diisi gas biar transaksi nggak gagal.`,
    estimateNote: 'Perkiraan dihitung dari biaya 1 kali kirim stablecoin.',
  },
  networkPicker: {
    title: 'Pilih Jaringan',
    moreLabel: (count: number) => `Lihat ${count} jaringan lainnya`,
  },
};

export type Dictionary = typeof id;
