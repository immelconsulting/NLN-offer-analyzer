/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // NLN brand palette
        navy: {
          50: "#D8F0F8",
          100: "#D8F0F8",
          200: "#D8F0F8",
          300: "#6BCCF7",
          400: "#6BCCF7",
          500: "#0099CC",
          600: "#0099CC",
          700: "#0099CC",
          800: "#16163F",
          900: "#16163F",
          950: "#001E34",
        },
      },
      fontFamily: {
        serif: ["Georgia", "Cambria", "Times New Roman", "serif"],
      },
    },
  },
  plugins: [],
};
