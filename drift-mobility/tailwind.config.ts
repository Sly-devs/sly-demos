import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Drift — transit/electric-blue palette.
        midnight: '#06121f',
        nav: '#0b1f33',
        deck: '#102942',
        line: 'rgba(255,255,255,0.07)',
        ev: {
          DEFAULT: '#16a4ff',
          deep: '#0476d4',
          soft: '#7ed1ff',
        },
        signal: '#f5d016',
        green: '#22d97c',
        red: '#ef4444',
        ash: '#9ca8b7',
        ink: '#f0f5ff',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 18px 50px -28px rgba(22,164,255,0.4), 0 0 0 1px rgba(255,255,255,0.05)',
        signal: '0 0 0 1px rgba(245,208,22,0.5), 0 12px 30px -10px rgba(245,208,22,0.4)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        ping: { '0%': { transform: 'scale(1)', opacity: '0.8' }, '100%': { transform: 'scale(2.4)', opacity: '0' } },
      },
      animation: {
        'fade-up': 'fade-up 0.4s cubic-bezier(0.22,1,0.36,1) both',
        ping: 'ping 1.6s ease-out infinite',
      },
    },
  },
  plugins: [],
};
export default config;
