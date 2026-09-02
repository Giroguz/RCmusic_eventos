/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0b0b10',
        panel: '#15151e',
        neon: '#d8ff39',
        violet: '#8b5cf6',
      },
      boxShadow: {
        glow: '0 0 35px rgba(216,255,57,.18)',
        violet: '0 0 35px rgba(139,92,246,.22)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'Inter', 'ui-sans-serif', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
