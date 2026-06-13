import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Span broker console — dark, premium, neutral.
        span: {
          bg: '#08090d',
          panel: '#0f1116',
          rail: '#0b0c11',
          card: '#15181f',
          cardhi: '#1a1e27',
          border: '#23262f',
          line: '#2c303b',
          glow: '#3a4fff',
          text: '#eef0f5',
          muted: '#9aa0b0',
          faint: '#676c7d',
          // ecosystem accents
          claude: '#d97757',
          chatgpt: '#10a37f',
          // protocol badge accents
          acp: '#7c9cff',
          ap2: '#f0b357',
          mpp: '#5fd2a6',
          ucp: '#c98bff',
          a2a: '#5fc7e8',
          x402: '#ff8da3',
        },
      },
      boxShadow: {
        'span-card': '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 30px -12px rgba(0,0,0,0.6)',
        'span-active':
          '0 0 0 1px rgba(124,156,255,0.25), 0 12px 40px -10px rgba(58,79,255,0.35)',
      },
      fontFamily: {
        sans: [
          'var(--font-sans)',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
    },
  },
  plugins: [],
};

export default config;
