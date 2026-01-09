/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'glass': {
          50: 'rgba(255, 255, 255, 0.05)',
          100: 'rgba(255, 255, 255, 0.1)',
          200: 'rgba(255, 255, 255, 0.2)',
        },
        'primary': {
          50: '#e6f0eb',
          100: '#b3d1c4',
          200: '#80b29d',
          300: '#4d9376',
          400: '#1a744f',
          500: '#014421', // Greenstone Primary (Pantone 3537 C)
          600: '#01361a',
          700: '#012814',
          800: '#001a0d',
          900: '#000c07',
        },
        'greenstone': {
          primary: '#014421', // Pantone 3537 C
          mint: '#8EC197', // Pantone 139-12 C
          gold: '#948A54', // Pantone 619 U
          platinum: '#7F7F7F', // Pantone 8401 C
          silver: '#E2E2E2', // Pantone 5523 M
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'glass': 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
        'glass-inset': 'inset 0 2px 4px 0 rgba(255, 255, 255, 0.1)',
      },
    },
  },
  plugins: [],
}

