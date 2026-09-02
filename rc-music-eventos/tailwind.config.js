/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0b0b10',
        panel: '#15151e',
        neon: '#ff3ea5',
        violet: '#a855f7',
      },
      boxShadow: {
        glow: '0 0 35px rgba(255,62,165,.24)',
        violet: '0 0 35px rgba(168,85,247,.25)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'Inter', 'ui-sans-serif', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
