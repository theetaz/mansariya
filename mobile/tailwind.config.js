/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.tsx", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          emerald: '#0F6E56',
          green: '#1D9E75',
          'green-soft': '#D7F0E5',
          amber: '#E89A3C',
          'amber-soft': '#FCE9CF',
          coral: '#E56A57',
          ink: '#0B1E18',
        },
        surface: {
          cream: '#F3F2EE',
          'cream-alt': '#E9E7E0',
          card: '#FFFFFF',
          'card-alt': '#F7F5F0',
          dark: '#07110D',
          'dark-alt': '#0D1A15',
          'dark-card': '#14221C',
        },
        road: '#378ADD',
      },
      borderRadius: {
        'xs': '6px',
        'sm': '10px',
        'md': '14px',
        'lg': '18px',
        'xl': '22px',
        '2xl': '28px',
      },
    },
  },
  plugins: [],
};
