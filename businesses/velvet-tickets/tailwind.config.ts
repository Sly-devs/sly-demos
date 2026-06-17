import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Velvet — poster aesthetic. Plum velvet + arcade neon.
        velvet: '#1a0826',
        deep: '#0c0414',
        plum: '#2a1240',
        rope: 'rgba(255,255,255,0.08)',
        line: 'rgba(255,255,255,0.1)',
        gold: '#f5cc4a',
        flame: '#ff5c2e',
        neon: '#ff5dd5',
        electric: '#7ff0ff',
        ink: '#0c0414',
        ash: '#a48ec5',
        bone: '#f6efe0',
      },
      fontFamily: {
        sans: ['"Manrope"', 'system-ui', 'sans-serif'],
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        poster: '0 60px 100px -30px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.08)',
        gold: '0 0 0 2px rgba(245,204,74,0.5), 0 18px 36px -16px rgba(245,204,74,0.45)',
        deny: '0 0 0 1px rgba(255,92,46,0.5), 0 14px 30px -16px rgba(255,92,46,0.35)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'stamp': { '0%': { transform: 'scale(1.6) rotate(-12deg)', opacity: '0' }, '60%': { transform: 'scale(0.9) rotate(-12deg)', opacity: '1' }, '100%': { transform: 'scale(1) rotate(-12deg)', opacity: '1' } },
        glow: { '0%, 100%': { opacity: '0.4', transform: 'scale(1)' }, '50%': { opacity: '0.7', transform: 'scale(1.04)' } },
        queue: { '0%': { transform: 'translateY(0)' }, '100%': { transform: 'translateY(-8px)' } },
      },
      animation: {
        'fade-up': 'fade-up 0.4s cubic-bezier(0.22,1,0.36,1) both',
        stamp: 'stamp 0.55s cubic-bezier(0.34,1.56,0.64,1) both',
        glow: 'glow 2.4s ease-in-out infinite',
        queue: 'queue 0.4s ease-out both',
      },
      backgroundImage: {
        velvety: 'radial-gradient(ellipse at top, rgba(245,204,74,0.06) 0%, transparent 60%), repeating-linear-gradient(45deg, rgba(255,255,255,0.015) 0 6px, transparent 6px 12px)',
      },
    },
  },
  plugins: [],
};
export default config;
