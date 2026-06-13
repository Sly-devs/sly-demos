import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Aster operator console — dense fintech dashboard identity.
        base: '#0a0b10', // app background
        panel: '#111420', // card / panel surface
        raised: '#181c2a', // raised rows, headers
        line: '#242938', // hairline borders
        ink: '#eceef5', // primary text
        mute: '#9097ab', // secondary text
        faint: '#5d6479', // tertiary text
        brand: '#7c7aff', // Aster indigo accent
        'brand-dim': '#4f4ea8', // muted indigo
        ok: '#34d399', // completed / pass
        warn: '#f5b14c', // review / caution
        bad: '#f4685f', // failed / blocked
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 0 rgba(255,255,255,0.02) inset, 0 1px 3px rgba(0,0,0,0.4)',
        glow: '0 0 0 1px rgba(124,122,255,0.3), 0 8px 24px -8px rgba(124,122,255,0.35)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.35s ease-out both',
      },
    },
  },
  plugins: [],
};

export default config;
