// Palet warna MyWallet: header teal, aksen biru, hijau untuk dana masuk.
// Dua set: terang & gelap, dengan nama kunci yang sama. tailwind.config.js
// memakai variabel CSS (`--c-…`) supaya class NativeWind ikut tema; kode TS
// (ikon, gradient) memakai src/theme/colors.ts.
const light = {
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
  /** Peringatan ringan, mis. gas menipis. */
  warning: {
    50: '#FFF5E6',
    500: '#F59E0B',
    600: '#B26A00',
  },
  /** Bahaya/kosong, mis. gas habis. */
  danger: {
    50: '#FDEDED',
    500: '#E5484D',
    600: '#C2353A',
  },
};

/**
 * Mode gelap: latar biru-abu tua, teks terang. Warna "-50" jadi latar redup,
 * dan "-600"/"-700" (dipakai sebagai teks di atas latar redup) jadi lebih
 * terang supaya tetap terbaca.
 */
const dark = {
  teal: {
    300: '#1D5C59',
    400: '#22716D',
    500: '#2A8A85',
  },
  primary: {
    50: '#172648',
    100: '#1E315C',
    500: '#4A80F5',
    600: '#7AA3FA',
    700: '#9CBBFC',
  },
  success: {
    50: '#0F2E1F',
    500: '#2CB86C',
    600: '#5BD892',
  },
  ink: {
    DEFAULT: '#E9EEF6',
    soft: '#C2CCDB',
    muted: '#8C99AF',
    faint: '#64728A',
  },
  canvas: '#0B1120',
  surface: '#141C2D',
  subtle: '#1B2437',
  tile: '#1E2940',
  line: '#27324A',
  warning: {
    50: '#33250B',
    500: '#F5A524',
    600: '#F8BE5C',
  },
  danger: {
    50: '#3A1518',
    500: '#EF5A5F',
    600: '#FF8589',
  },
};

/** `#2F6BF2` → `"47 107 242"` untuk `rgb(var(--c-…) / alpha)`. */
const hexToRgb = (hex) =>
  [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16)).join(' ');

/** Nama variabel per warna: `ink.DEFAULT` → `--c-ink`, `primary.500` → `--c-primary-500`. */
function cssVars(palette) {
  const vars = {};
  for (const [name, value] of Object.entries(palette)) {
    if (typeof value === 'string') vars[`--c-${name}`] = hexToRgb(value);
    else
      for (const [shade, hex] of Object.entries(value))
        vars[shade === 'DEFAULT' ? `--c-${name}` : `--c-${name}-${shade}`] = hexToRgb(hex);
  }
  return vars;
}

/** Warna Tailwind yang menunjuk ke variabel CSS (struktur sama dengan palet). */
function tailwindColors(palette) {
  const ref = (name) => `rgb(var(${name}) / <alpha-value>)`;
  const colors = {};
  for (const [name, value] of Object.entries(palette)) {
    if (typeof value === 'string') colors[name] = ref(`--c-${name}`);
    else {
      colors[name] = {};
      for (const shade of Object.keys(value))
        colors[name][shade] = ref(shade === 'DEFAULT' ? `--c-${name}` : `--c-${name}-${shade}`);
    }
  }
  return colors;
}

module.exports = { light, dark, cssVars, tailwindColors };
