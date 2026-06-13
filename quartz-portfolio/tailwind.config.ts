import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Quartz palette — clean white financial UI with deep navy + emerald.
        pearl: '#fbfcfd',
        sand: '#f4f6fa',
        mist: '#e8edf3',
        line: '#d8dfe8',
        ink: '#0b1a2c',
        navy: '#1e3a5f',
        ash: '#5b6b80',
        emerald: {
          DEFAULT: '#0f9d6a',
          deep: '#066947',
          soft: '#bce5d2',
        },
        ember: '#d5474f',
        amber: '#daa419',
        cobalt: '#2a52c9',
        violet: '#5a48d6',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"GT Sectra"', '"Cormorant Garamond"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 14px 40px -20px rgba(11,26,44,0.12), 0 2px 4px rgba(11,26,44,0.04)',
        focus: '0 0 0 4px rgba(15,157,106,0.18)',
        deny: '0 0 0 4px rgba(213,71,79,0.18)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        sweep: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.4s cubic-bezier(0.22,1,0.36,1) both',
        sweep: 'sweep 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
