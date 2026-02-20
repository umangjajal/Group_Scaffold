/** @type {import('tailwindcss').Config} */
import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}', // Scan all files in src directory
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2563eb',
        secondary: '#9333ea',
        accent: '#f59e0b',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [forms, typography],
};