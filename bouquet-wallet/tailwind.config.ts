import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Bouquet gifting palette — warm cream paper, blush accents, sage success.
        paper: '#fbf6ee',
        cream: '#f4ead8',
        ivory: '#ffffff',
        ink: '#2c2724',
        bark: '#5b4f48',
        stone: '#a39a92',
        whisper: '#e9dfc9',
        blush: {
          DEFAULT: '#e8a298',
          deep: '#cc7e72',
          soft: '#f4cdc4',
        },
        sage: {
          DEFAULT: '#7a9b76',
          deep: '#5d7d59',
          soft: '#c9dec5',
        },
        butter: '#f0c878',
        rose: '#dd6b75',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        card: '0 24px 60px -28px rgba(80, 50, 40, 0.18), 0 2px 4px rgba(80, 50, 40, 0.04)',
        envelope: '0 30px 70px -20px rgba(180, 100, 90, 0.35), 0 0 0 1px rgba(232, 162, 152, 0.18)',
        soft: '0 10px 30px -12px rgba(80, 50, 40, 0.15)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'float-petal': {
          '0%, 100%': { transform: 'translateY(0) rotate(-2deg)' },
          '50%': { transform: 'translateY(-6px) rotate(2deg)' },
        },
        bloom: {
          '0%': { transform: 'scale(0.92)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'envelope-seal': {
          '0%': { transform: 'rotateX(0deg)' },
          '100%': { transform: 'rotateX(180deg)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both',
        'float-petal': 'float-petal 4s ease-in-out infinite',
        bloom: 'bloom 0.6s cubic-bezier(0.22,1,0.36,1) both',
        'envelope-seal': 'envelope-seal 0.8s cubic-bezier(0.22,1,0.36,1) both',
      },
    },
  },
  plugins: [],
};

export default config;
