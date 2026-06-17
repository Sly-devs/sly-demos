import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Helix — a live operations wall-board. Deep night console with
        // protocol-coded accents. Distinct from Forum/Aster/Lume.
        void: '#070a12', // page background (near-black blue)
        panel: '#0d1220', // surface
        panel2: '#121a2c', // raised surface
        line: '#1e2940', // hairline
        ink: '#eef2fb', // primary text
        mute: '#8a96b4', // secondary text
        dim: '#5a684f', // faint text
        // Protocol palette — each rail owns a hue.
        x402: '#5eead4', // teal
        ucp: '#a78bfa', // violet
        acp: '#f0a93b', // amber
        a2a: '#60a5fa', // blue
        pulse: '#34d399', // settled / live green
        warn: '#fb7185',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        widest: '0.24em',
        mega: '0.34em',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(94,234,212,0.18), 0 18px 50px -24px rgba(52,211,153,0.45)',
        panel: '0 1px 0 rgba(255,255,255,0.03) inset, 0 24px 60px -32px rgba(0,0,0,0.8)',
      },
      keyframes: {
        'rise-in': {
          '0%': { opacity: '0', transform: 'translateY(10px) scale(0.99)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'pulse-ring': {
          '0%': { opacity: '0.7', transform: 'scale(0.85)' },
          '70%': { opacity: '0', transform: 'scale(1.9)' },
          '100%': { opacity: '0', transform: 'scale(1.9)' },
        },
        sheen: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'rise-in': 'rise-in 0.55s cubic-bezier(0.22,1,0.36,1) both',
        'pulse-ring': 'pulse-ring 2.4s ease-out infinite',
        sheen: 'sheen 2.6s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
