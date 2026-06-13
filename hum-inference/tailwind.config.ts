import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Hum — pocket-supercomputer. Inky dark + bioluminescent green pulse.
        ink: '#040d0a',
        deepwell: '#08161a',
        slab: '#0e1f24',
        rib: 'rgba(255,255,255,0.05)',
        line: 'rgba(255,255,255,0.08)',
        glow: '#3effb0',
        glowdim: '#1aa376',
        cyan: '#76f0ff',
        signal: '#ffcb39',
        warn: '#ff6a5b',
        ash: '#7b8b88',
        bone: '#e9f5f1',
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        phone: '0 60px 100px -30px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.08), inset 0 0 0 1px rgba(255,255,255,0.04)',
        glow: '0 0 0 1px rgba(62,255,176,0.45), 0 18px 36px -16px rgba(62,255,176,0.45)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'slide-in': { '0%': { opacity: '0', transform: 'translateY(-10px) scale(0.97)' }, '100%': { opacity: '1', transform: 'translateY(0) scale(1)' } },
        'slide-out': { '0%': { opacity: '1', transform: 'translateY(0)' }, '100%': { opacity: '0', transform: 'translateY(-16px)' } },
        pulse: { '0%, 100%': { transform: 'scale(1)', opacity: '0.9' }, '50%': { transform: 'scale(1.08)', opacity: '0.5' } },
        ring: { '0%': { transform: 'scale(1)', opacity: '0.45' }, '100%': { transform: 'scale(2.4)', opacity: '0' } },
        bar: { '0%, 100%': { transform: 'scaleY(0.4)' }, '50%': { transform: 'scaleY(1)' } },
        flash: { '0%': { backgroundColor: 'rgba(62,255,176,0.20)' }, '100%': { backgroundColor: 'transparent' } },
      },
      animation: {
        'fade-up': 'fade-up 0.4s cubic-bezier(0.22,1,0.36,1) both',
        'slide-in': 'slide-in 0.35s cubic-bezier(0.22,1,0.36,1) both',
        'slide-out': 'slide-out 0.4s cubic-bezier(0.5,0,0.75,0) both',
        pulse: 'pulse 1.8s ease-in-out infinite',
        ring: 'ring 1.6s ease-out infinite',
        bar: 'bar 0.9s ease-in-out infinite',
        flash: 'flash 0.7s ease-out both',
      },
    },
  },
  plugins: [],
};
export default config;
