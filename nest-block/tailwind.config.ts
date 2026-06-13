import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Nest — warm community, paper-letter aesthetic.
        paper: '#fbf6ec',
        cream: '#f4ecd9',
        mast: '#e3d7b4',
        ink: '#22241e',
        ash: '#6c6852',
        sun: '#e8a23a',
        moss: '#3f7a4a',
        mosssoft: '#dbe7d8',
        brick: '#b8412a',
        bricksoft: '#f4d9d0',
        sky: '#7eb5c2',
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        display: ['"Caveat"', 'cursive'],
        serif: ['"Fraunces"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        paper: '0 8px 24px -16px rgba(34,36,30,0.2), 0 0 0 1px rgba(34,36,30,0.06)',
        pin: '0 8px 18px -8px rgba(34,36,30,0.4)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'pin-drop': { '0%': { transform: 'translateY(-12px) scale(0.8)', opacity: '0' }, '70%': { transform: 'translateY(2px) scale(1.05)' }, '100%': { transform: 'translateY(0) scale(1)', opacity: '1' } },
        wiggle: { '0%, 100%': { transform: 'rotate(-2deg)' }, '50%': { transform: 'rotate(2deg)' } },
      },
      animation: {
        'fade-up': 'fade-up 0.4s cubic-bezier(0.22,1,0.36,1) both',
        'pin-drop': 'pin-drop 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
        wiggle: 'wiggle 0.4s ease-in-out',
      },
    },
  },
  plugins: [],
};
export default config;
