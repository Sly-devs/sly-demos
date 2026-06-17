import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Anvil — industrial / blueprint palette.
        steel: '#0a0d12',
        slate: '#131922',
        plate: '#1c2530',
        rib: 'rgba(255,255,255,0.06)',
        line: 'rgba(255,255,255,0.1)',
        weld: '#ff7a1a',
        spark: '#ffd83a',
        cyan: '#5dd3ff',
        green: '#22d97c',
        gunmetal: '#65788d',
        chalk: '#f1f5fa',
      },
      fontFamily: {
        sans: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        plate: 'inset 0 0 0 1px rgba(255,255,255,0.06), 0 14px 36px -16px rgba(0,0,0,0.6)',
        weld: '0 0 0 1px rgba(255,122,26,0.5), 0 18px 36px -16px rgba(255,122,26,0.5)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'rank-up': { '0%': { backgroundPositionX: '0%' }, '100%': { backgroundPositionX: '200%' } },
      },
      animation: {
        'fade-up': 'fade-up 0.4s cubic-bezier(0.22,1,0.36,1) both',
        'rank-up': 'rank-up 1.8s linear infinite',
      },
      backgroundImage: {
        grid: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
      },
      backgroundSize: { grid: '24px 24px' },
    },
  },
  plugins: [],
};
export default config;
