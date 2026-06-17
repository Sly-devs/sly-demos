import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Mint — green-ledger accountant aesthetic.
        slate: '#0c1419',
        deck: '#15212a',
        plate: '#1c2c37',
        line: 'rgba(255,255,255,0.07)',
        rib: 'rgba(255,255,255,0.04)',
        gain: '#41e3a0',
        gainsoft: '#1d3d31',
        loss: '#ee5d4f',
        ledger: '#cdb878',     // antique ledger yellow
        ink: '#0a0f12',
        ash: '#7d8a93',
        bone: '#e6efe9',
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 12px 30px -16px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.05)',
        gain: '0 0 0 1px rgba(65,227,160,0.4), 0 14px 30px -16px rgba(65,227,160,0.35)',
        loss: '0 0 0 1px rgba(238,93,79,0.4), 0 14px 30px -16px rgba(238,93,79,0.35)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'tape-up': { '0%': { transform: 'translateY(12px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        'pulse-dot': { '0%, 100%': { transform: 'scale(1)', opacity: '0.7' }, '50%': { transform: 'scale(1.6)', opacity: '0' } },
        ticker: { '0%': { transform: 'translateX(0)' }, '100%': { transform: 'translateX(-100%)' } },
      },
      animation: {
        'fade-up': 'fade-up 0.4s cubic-bezier(0.22,1,0.36,1) both',
        'tape-up': 'tape-up 0.45s cubic-bezier(0.22,1,0.36,1) both',
        'pulse-dot': 'pulse-dot 1.6s ease-in-out infinite',
        ticker: 'ticker 60s linear infinite',
      },
    },
  },
  plugins: [],
};
export default config;
