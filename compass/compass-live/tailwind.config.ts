import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Compass Live — deep terminal night with cool gate-status accents.
        ink: '#06070a',
        slatebg: '#0b1018',
        edge: 'rgba(255,255,255,0.07)',
        approve: '#34d399',
        deny: '#fb7185',
        scope: '#60a5fa',
        compass: '#a78bfa',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
