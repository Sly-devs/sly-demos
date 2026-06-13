import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Loom palette — terminal-graphite, electric cyan meter, lime confirm.
        graphite: '#0c0f14',
        slate: '#161b24',
        rack: '#1f2733',
        wire: 'rgba(255,255,255,0.06)',
        cyan: {
          DEFAULT: '#2dd4ff',
          deep: '#0ea5e9',
          soft: '#7ce6ff',
        },
        lime: {
          DEFAULT: '#a3e635',
          deep: '#65a30d',
        },
        amber: '#fbbf24',
        rust: '#f97362',
        mist: '#cbd5e1',
        graymute: '#64748b',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        rack: '0 18px 50px -30px rgba(45,212,255,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
        card: '0 20px 50px -28px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05)',
      },
      keyframes: {
        'pulse-tick': {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        'meter-flow': {
          '0%': { backgroundPosition: '0% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'pulse-tick': 'pulse-tick 1.2s ease-in-out infinite',
        'meter-flow': 'meter-flow 2s linear infinite',
        'fade-up': 'fade-up 0.4s cubic-bezier(0.22,1,0.36,1) both',
      },
    },
  },
  plugins: [],
};

export default config;
