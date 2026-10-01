// Palet warna MyWallet: header teal, aksen biru, hijau untuk dana masuk.
// Dipakai bareng oleh tailwind.config.js (class NativeWind) dan kode TS
// (ikon, gradient) lewat src/theme/colors.ts.
module.exports = {
  teal: {
    300: '#86DAD4',
    400: '#5ECEC8',
    500: '#3BC1BB',
  },
  primary: {
    50: '#EEF4FF',
    100: '#DCE8FF',
    500: '#2F6BF2',
    600: '#2457D6',
    700: '#1D46AE',
  },
  success: {
    50: '#E6F6EC',
    500: '#1FA35B',
    600: '#178A4B',
  },
  ink: {
    DEFAULT: '#0F172A',
    soft: '#334155',
    muted: '#64748B',
    faint: '#94A3B8',
  },
  /** Latar lembaran konten. */
  canvas: '#F3F5F9',
  surface: '#FFFFFF',
  /** Kartu abu-abu muda, mis. kartu Total Saldo. */
  subtle: '#F1F4F8',
  /** Latar tombol aksi cepat. */
  tile: '#EDF2F9',
  line: '#E8EDF3',
  danger: '#E5484D',
};
