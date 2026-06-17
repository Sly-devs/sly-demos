import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Pocket — vibrant retro-arcade for the kid view + parent guardrails.
        bg: '#0a0223',
        deep: '#160438',
        lane: '#2a0a5e',
        line: 'rgba(255,255,255,0.08)',
        sky: '#42d8ff',
        magenta: '#ff43a4',
        lime: '#9bff5d',
        coin: '#ffd23a',
        legendary: '#a96cff',
        rare: '#41d4ff',
        common: '#9a9fad',
        deny: '#ff5b5b',
        bone: '#f4f0ff',
        ash: '#a39bbf',
      },
      fontFamily: {
        sans: ['"Outfit"', 'system-ui', 'sans-serif'],
        display: ['"Press Start 2P"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        hud: '0 8px 30px -10px rgba(255,67,164,0.5), inset 0 0 0 1px rgba(255,255,255,0.06)',
        coin: '0 0 0 2px rgba(255,210,58,0.6), 0 14px 30px -10px rgba(255,210,58,0.5)',
        denyglow: '0 0 0 2px rgba(255,91,91,0.45), 0 14px 30px -10px rgba(255,91,91,0.4)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        bob: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-4px)' } },
        sparkle: { '0%, 100%': { opacity: '0.5', transform: 'scale(1)' }, '50%': { opacity: '1', transform: 'scale(1.3)' } },
        shake: { '0%, 100%': { transform: 'translateX(0)' }, '20%, 60%': { transform: 'translateX(-4px)' }, '40%, 80%': { transform: 'translateX(4px)' } },
      },
      animation: {
        'fade-up': 'fade-up 0.4s cubic-bezier(0.22,1,0.36,1) both',
        bob: 'bob 2.4s ease-in-out infinite',
        sparkle: 'sparkle 1.8s ease-in-out infinite',
        shake: 'shake 0.5s ease-in-out',
      },
      backgroundImage: {
        scan: 'repeating-linear-gradient(180deg, rgba(255,255,255,0.02) 0 2px, transparent 2px 4px)',
      },
    },
  },
  plugins: [],
};
export default config;
