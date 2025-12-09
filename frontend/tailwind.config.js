/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#c52e33',
        'primary-dark': '#80000d',
        dark: '#2b2b2b',
        light: '#ffffff',
      },
    },
  },
  plugins: [],
}
