/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primaryOrange: "#f97316", // orange-500
        softYellow: "#fde047",    // yellow-300
        lightGrey: "#f3f4f6",     // gray-100
        darkGrey: "#374151"       // gray-700
      }
    },
  },
  plugins: [],
};
