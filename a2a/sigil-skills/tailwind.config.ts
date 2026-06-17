import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Sigil — arcane/lab palette. Black with violet + cyan glyph accents.
        void: '#06070d',
        cell: '#0d1018',
        carbon: '#161a26',
        line: 'rgba(255,255,255,0.08)',
        rune: '#9d7bff',
        runelite: '#c8b3ff',
        arc: '#33e9c8',
        gold: '#f5cc4a',
        warn: '#ff6757',
        ash: '#8895a8',
        bone: '#e8edf5',
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        rune: '0 0 0 1px rgba(157,123,255,0.4), 0 18px 36px -16px rgba(157,123,255,0.45)',
        card: '0 14px 36px -22px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'rune-spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } },
        countdown: { '0%': { strokeDashoffset: '0' }, '100%': { strokeDashoffset: '188' } },
        revoke: { '0%': { opacity: '1' }, '100%': { opacity: '0.3', textDecoration: 'line-through' } },
      },
      animation: {
        'fade-up': 'fade-up 0.4s cubic-bezier(0.22,1,0.36,1) both',
        'rune-spin': 'rune-spin 14s linear infinite',
        countdown: 'countdown 8s linear forwards',
        revoke: 'revoke 0.7s ease-out forwards',
      },
    },
  },
  plugins: [],
};
export default config;
