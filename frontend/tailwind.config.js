/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        railNavy: '#0B192C',
        railRed: '#D90429',
        railAmber: '#F7B801',
        railBgLight: '#F8F9FA',
        railBgDark: '#0A0E17',
        railCardDark: '#121824',
        railBorderLight: 'rgba(11, 25, 44, 0.12)',
        railBorderDark: 'rgba(255, 255, 255, 0.08)',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono: ['Space Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
