import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Lume — warm editorial home-goods identity (distinct from Crate).
        umber: '#2a211b', // near-black warm brown (ink)
        cream: '#f3ebde', // page background
        parch: '#fcf8f1', // card surface
        terra: '#a8552f', // accent / CTA
        sage: '#857f63', // muted secondary
        gilt: '#c39a52', // hairline / detail
        clay: '#e7dac6', // soft fill / tonal block
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        widest: '0.28em',
        editorial: '0.34em',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(42, 33, 27, 0.04), 0 12px 32px -16px rgba(42, 33, 27, 0.18)',
        lift: '0 2px 4px rgba(42, 33, 27, 0.05), 0 24px 48px -20px rgba(42, 33, 27, 0.26)',
      },
      keyframes: {
        'rise-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'rise-in': 'rise-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
};

export default config;
