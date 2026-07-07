/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}"],
  theme: {
    extend: {
      colors: {
        // Dezente, vertrauenswürdige Palette (Teal/Blau).
        brand: {
          50: "#eff9f8",
          100: "#d6efec",
          200: "#b0dfda",
          300: "#7fc7c0",
          400: "#4ba79f",
          500: "#2f8a82",
          600: "#256e69",
          700: "#215955",
          800: "#1f4845",
          900: "#1d3d3b",
        },
      },
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      maxWidth: {
        content: "72rem",
      },
    },
  },
  plugins: [],
};
