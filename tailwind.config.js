/** @type {import('tailwindcss').Config} */
// AMATISTA DENTAL — tema dorado con acento amatista (morado).
// Se redefine `brand` a dorado y se SOBRESCRIBEN las paletas `pink`/`fuchsia`
// del molde a tonos dorados, de modo que todas las clases heredadas
// (pink-*, fuchsia-*, brand-*) se recoloreen a oro automáticamente.
const gold = {
  50: '#fbf8ef',
  100: '#f7efd6',
  200: '#eedfae',
  300: '#e3ca79',
  400: '#d4af37',
  500: '#c9a227',
  600: '#a9851f',
  700: '#86671b',
  800: '#6d531c',
  900: '#5c461b',
}
const bronce = {
  50: '#faf6ea',
  100: '#f3e9c9',
  200: '#e7d196',
  300: '#d8b65c',
  400: '#cda53a',
  500: '#bf922a',
  600: '#a87d1d',
  700: '#876418',
  800: '#6d521a',
  900: '#5b4419',
}
const amatista = {
  50: '#faf5ff',
  100: '#f3e8ff',
  200: '#e9d5ff',
  300: '#d8b4fe',
  400: '#a855f7',
  500: '#9333ea',
  600: '#7e22ce',
  700: '#6b21a8',
}

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: gold,
        gold,
        amatista,
        // Sobrescribir las paletas del molde para recolorear a dorado.
        pink: gold,
        fuchsia: bronce,
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,.04), 0 10px 30px -10px rgba(201,162,39,.30)',
        '3d': '0 22px 45px -12px rgba(201,162,39,.45), 0 10px 18px -8px rgba(212,175,55,.38)',
        btn: '0 10px 24px -6px rgba(201,162,39,.55)',
        gold: '0 10px 24px -6px rgba(212,175,55,.5)',
        glow: '0 0 0 4px rgba(212,175,55,.18)',
      },
      backgroundImage: {
        'brand-grad': 'linear-gradient(135deg,#e3ca79 0%,#d4af37 45%,#c9a227 100%)',
        'gold-grad': 'linear-gradient(135deg,#f5c869 0%,#d4af37 100%)',
        'app-bg': 'radial-gradient(1100px 600px at 100% -10%, rgba(201,162,39,.10), transparent), radial-gradient(900px 500px at -10% 110%, rgba(147,51,234,.07), transparent)',
      },
    },
  },
  plugins: [],
}
