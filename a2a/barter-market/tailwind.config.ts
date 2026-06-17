import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Barter — warm bazaar / amber & terracotta palette.
        bone: '#fcf7ef',
        sand: '#f3e9d6',
        rope: '#d8c7a4',
        clay: '#b07a3a',
        terra: '#9c3f1f',
        spice: '#d96b1b',
        moss: '#587339',
        ink: '#241b13',
        ash: '#7a6d5b',
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        serif: ['"Crimson Pro"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        woven: 'inset 0 0 0 1px rgba(36,27,19,0.12), 0 12px 30px -16px rgba(156,63,31,0.3)',
        deal: '0 0 0 1px rgba(88,115,57,0.45), 0 20px 35px -14px rgba(88,115,57,0.4)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(6px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        stamp: { '0%': { transform: 'scale(1.6) rotate(-8deg)', opacity: '0' }, '60%': { transform: 'scale(0.9) rotate(-8deg)', opacity: '1' }, '100%': { transform: 'scale(1) rotate(-8deg)', opacity: '1' } },
      },
      animation: {
        'fade-up': 'fade-up 0.45s cubic-bezier(0.22,1,0.36,1) both',
        stamp: 'stamp 0.55s cubic-bezier(0.34,1.56,0.64,1) both',
      },
      backgroundImage: {
        weave: 'repeating-linear-gradient(45deg, rgba(176,122,58,0.06) 0 6px, transparent 6px 12px)',
      },
    },
  },
  plugins: [],
};
export default config;
