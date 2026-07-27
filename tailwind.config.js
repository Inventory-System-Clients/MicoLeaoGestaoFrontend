/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#F4511E",
          light: "#FF7043",
          dark: "#111111",
        },
        secondary: {
          DEFAULT: "#FFE2D6",
          light: "#FFF7F3",
        },
        background: {
          dark: "#111111",
          light: "#FFF7F3",
        },
        accent: {
          orange: "#F4511E",
          yellow: "#FF8A3D",
          cream: "#FFE2D6",
          red: "#E92D22",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
