const { light, tailwindColors } = require('./src/theme/palette');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // Nilai aslinya dipasang sebagai variabel CSS oleh ThemeProvider (terang/gelap).
      colors: tailwindColors(light),
    },
  },
  plugins: [],
};
