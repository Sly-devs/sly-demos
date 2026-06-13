import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#16130f',
        sand: '#f7f3ec',
        cream: '#fdfbf7',
        clay: '#c8623a',
        'clay-deep': '#a84d2a',
        moss: '#3f7d56',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(22,19,15,0.04), 0 8px 24px -12px rgba(22,19,15,0.12)',
        lift: '0 2px 4px rgba(22,19,15,0.05), 0 18px 40px -16px rgba(22,19,15,0.22)',
        cta: '0 1px 2px rgba(200,98,58,0.25), 0 16px 36px -12px rgba(200,98,58,0.45)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'draw-check': {
          '0%': { strokeDashoffset: '24' },
          '100%': { strokeDashoffset: '0' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-150% 0' },
          '100%': { backgroundPosition: '250% 0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both',
        'scale-in': 'scale-in 0.4s cubic-bezier(0.22,1,0.36,1) both',
        'draw-check': 'draw-check 0.5s ease-out 0.1s both',
        shimmer: 'shimmer 2s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
