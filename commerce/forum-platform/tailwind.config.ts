import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Forum — modern marketplace-infra SaaS. Confident, trustworthy,
        // cool ink on a bright surface with one decisive indigo and a
        // human/agent signal pair. Distinct from Aster (dark console) and
        // Lume (warm editorial).
        ink: '#11131c', // primary text — near-black blue
        slate: '#5b6173', // secondary text
        mist: '#8b91a4', // tertiary / captions
        line: '#e6e8f0', // hairlines & borders
        panel: '#ffffff', // card surface
        canvas: '#f6f7fb', // page background
        indigo: '#4f46e5', // brand / primary action
        indigodark: '#3730a3', // brand pressed
        wash: '#eef0fc', // tonal indigo fill
        human: '#0d9488', // HUMAN identity signal (teal)
        agent: '#7c3aed', // AI-AGENT identity signal (violet)
        gold: '#b58a2b', // reputation / stars
        ok: '#0f9d58', // settled / positive
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        widest: '0.22em',
        eyebrow: '0.3em',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(17, 19, 28, 0.04), 0 16px 40px -24px rgba(17, 19, 28, 0.18)',
        lift: '0 2px 6px rgba(17, 19, 28, 0.05), 0 28px 56px -28px rgba(17, 19, 28, 0.26)',
        glow: '0 0 0 1px rgba(79, 70, 229, 0.18), 0 18px 48px -22px rgba(79, 70, 229, 0.45)',
      },
      keyframes: {
        'rise-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
        'sweep': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'rise-in': 'rise-in 0.55s cubic-bezier(0.22, 1, 0.36, 1) both',
        'pulse-dot': 'pulse-dot 1.8s ease-in-out infinite',
        sweep: 'sweep 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
