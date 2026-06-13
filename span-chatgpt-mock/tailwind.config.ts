import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ChatGPT 2024-2025 dark palette (sampled from chatgpt.com)
        cgpt: {
          bg: '#212121',
          panel: '#171717',
          sidebar: '#171717',
          bubble: '#303030',
          border: '#373737',
          hairline: '#2f2f2f',
          text: '#ececec',
          muted: '#b4b4b4',
          faint: '#8f8f8f',
          accent: '#0d8a6a',
          accenthover: '#0a7457',
          field: '#303030',
          fieldborder: '#414141',
          send: '#ffffff',
          chip: '#2f2f2f',
          chiphover: '#373737',
          // Stripe ACS confirm-purchase card
          stripe: '#635bff',
          stripeink: '#0a2540',
        },
      },
      fontFamily: {
        sans: [
          'var(--font-sans)',
          'Söhne',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};

export default config;
