import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Echo — cool mint/iris palette · "attention-as-asset" calm tech.
        veil: '#f7faf9',
        chrome: '#e9efee',
        mist: '#cad6d2',
        glass: 'rgba(255,255,255,0.6)',
        iris: '#5b6dd6',
        mint: '#19a692',
        coral: '#e85f4a',
        sand: '#f0d480',
        graphite: '#1a2422',
        ash: '#5d6c69',
      },
      fontFamily: {
        sans: ['"Public Sans"', 'system-ui', 'sans-serif'],
        display: ['"Fraunces"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 8px 30px -16px rgba(26,36,34,0.18), 0 0 0 1px rgba(26,36,34,0.04)',
        accept: '0 0 0 2px rgba(25,166,146,0.55), 0 18px 40px -16px rgba(25,166,146,0.45)',
        reject: '0 0 0 2px rgba(232,95,74,0.5), 0 14px 30px -16px rgba(232,95,74,0.35)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'slide-out': { '0%': { opacity: '1', transform: 'translateX(0)' }, '100%': { opacity: '0', transform: 'translateX(-32px)' } },
        wave: { '0%, 100%': { transform: 'scaleY(0.4)' }, '50%': { transform: 'scaleY(1)' } },
      },
      animation: {
        'fade-up': 'fade-up 0.4s cubic-bezier(0.22,1,0.36,1) both',
        'slide-out': 'slide-out 0.6s cubic-bezier(0.5,0,0.75,0) both',
        wave: 'wave 1s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
export default config;
