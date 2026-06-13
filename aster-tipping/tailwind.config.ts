import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Aster Tipping — sunset/creator economy palette.
        dusk: '#15101c',
        deep: '#1d1424',
        plum: '#321d3a',
        edge: 'rgba(255,255,255,0.08)',
        peach: '#ff9d6c',
        magenta: '#ec4899',
        lavender: '#a78bfa',
        gold: '#fcd34d',
        mint: '#5eead4',
        cream: '#fef3e2',
        smoke: '#a18ca5',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        creator: '0 22px 60px -28px rgba(236,72,153,0.45), 0 0 0 1px rgba(255,255,255,0.08)',
        tip: '0 18px 40px -20px rgba(252,211,77,0.5), inset 0 1px 0 rgba(255,255,255,0.18)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-bright': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        'tip-pop': {
          '0%': { transform: 'scale(0.5) translateY(0)', opacity: '0' },
          '60%': { transform: 'scale(1.15) translateY(-8px)', opacity: '1' },
          '100%': { transform: 'scale(1) translateY(-16px)', opacity: '0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.45s cubic-bezier(0.22,1,0.36,1) both',
        'pulse-bright': 'pulse-bright 1.2s ease-in-out infinite',
        'tip-pop': 'tip-pop 0.9s cubic-bezier(0.22,1,0.36,1) both',
      },
    },
  },
  plugins: [],
};

export default config;
