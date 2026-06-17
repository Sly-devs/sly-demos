import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Trim — clean blue/lemon money app. Different from Quartz (pearl) and Echo (mint).
        snow: '#f6f8fc',
        paper: '#ffffff',
        cloud: '#e7ecf3',
        line: '#dbe1ec',
        ink: '#0e1825',
        ash: '#5d6a80',
        leaf: '#11a26b',
        leafsoft: '#dff5e8',
        chart: '#2a5cff',
        chartsoft: '#e1e8ff',
        lemon: '#ffd34a',
        rose: '#e3504a',
        rosesoft: '#fbe2e0',
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        display: ['"Instrument Serif"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 2px 0 rgba(14,24,37,0.04), 0 18px 36px -22px rgba(14,24,37,0.18), 0 0 0 1px rgba(14,24,37,0.05)',
        save: '0 0 0 2px rgba(17,162,107,0.45), 0 18px 36px -16px rgba(17,162,107,0.4)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        strike: { '0%': { width: '0%' }, '100%': { width: '100%' } },
        'count-up': { '0%': { transform: 'translateY(12px)' }, '100%': { transform: 'translateY(0)' } },
      },
      animation: {
        'fade-up': 'fade-up 0.4s cubic-bezier(0.22,1,0.36,1) both',
        strike: 'strike 0.4s ease-out both',
        'count-up': 'count-up 0.5s cubic-bezier(0.22,1,0.36,1) both',
      },
    },
  },
  plugins: [],
};
export default config;
