/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Warm-but-dark palette
        ink: {
          900: "#13110f",
          800: "#1c1916",
          700: "#272320",
          600: "#352f2a",
          500: "#473f38",
        },
        cream: {
          100: "#f5ede3",
          200: "#e7dccd",
          300: "#cdbfac",
          400: "#a99a85",
        },
        ember: {
          400: "#f0a868",
          500: "#e58a3c",
          600: "#cf6f25",
        },
        sage: {
          400: "#9bbf8a",
          500: "#7aa766",
        },
        berry: {
          400: "#e0728a",
          500: "#cf4f6e",
        },
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
