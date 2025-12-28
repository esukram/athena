/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#6750A4',
          50: '#F5F3FF',
          100: '#EDE9FE',
          200: '#DDD6FE',
          300: '#C4B5FD',
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#6750A4',
          700: '#5B21B6',
          800: '#4C1D95',
          900: '#2E1065',
        },
        surface: {
          DEFAULT: '#FFFBFE',
          container: '#F3EDF7',
          'container-low': '#F7F2FA',
          'container-high': '#ECE6F0',
          variant: '#E7E0EC',
        },
        background: '#FFFBFE',
        error: '#B3261E',
        'on-surface': '#1C1B1F',
        'on-surface-variant': '#49454F',
        'on-background': '#1C1B1F',
        'on-primary': '#FFFFFF',
      },
    },
  },
  plugins: [],
}
