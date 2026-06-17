import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Coral wallet palette — deep ink canvas, warm coral accent, mint success.
        canvas: '#070a12',
        surface: '#0f1422',
        elevate: '#161c2e',
        hairline: 'rgba(255,255,255,0.07)',
        coral: {
          DEFAULT: '#ff6b5a',
          soft: '#ff8b7d',
          deep: '#e0492f',
        },
        mint: '#34d8a4',
        gold: '#f6c768',
        cloud: '#f4f6fb',
        mute: '#8a93a8',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        device: '0 40px 90px -30px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)',
        card: '0 18px 40px -24px rgba(0,0,0,0.65)',
        glow: '0 0 0 1px rgba(255,107,90,0.35), 0 14px 40px -16px rgba(255,107,90,0.45)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'sheet-up': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.85)', opacity: '0.7' },
          '70%': { transform: 'scale(1.15)', opacity: '0' },
          '100%': { opacity: '0' },
        },
        'scan-line': {
          '0%,100%': { transform: 'translateY(-50%)' },
          '50%': { transform: 'translateY(50%)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.45s cubic-bezier(0.22,1,0.36,1) both',
        'sheet-up': 'sheet-up 0.4s cubic-bezier(0.22,1,0.36,1) both',
        'pulse-ring': 'pulse-ring 1.8s ease-out infinite',
        'scan-line': 'scan-line 2s ease-in-out infinite',
        shimmer: 'shimmer 2.4s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
