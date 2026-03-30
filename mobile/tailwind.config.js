/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.tsx", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          green: '#1D9E75',
          'green-light': '#E1F5EE',
          'green-dark': '#0F6E56',
        },
        road: '#378ADD',
        alert: '#BA7517',
        danger: '#E24B4A',
      },
    },
  },
  plugins: [],
};
