/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}",
    "./public/**/*.html",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Manrope", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Courier New", "monospace"],
      },
      colors: {
        usfx: {
          50:  "#f5f3ff",
          100: "#ede9fd",
          200: "#ddd8fb",
          300: "#c3b9f4",
          400: "#a593ea",
          500: "#876fdf",
          600: "#6b52cc",
          700: "#503AA8",  // brand principal
          800: "#3d2c88",
          900: "#2c1f66",
          950: "#180f3e",
        },
        gold: {
          300: "#fff176",
          400: "#FFEE58",
          500: "#fdd835",
          700: "#5f4200",
        },
        "usfx-blue": {
          DEFAULT: "#1A3A7A",
          light:   "#e8eef8",
          dark:    "#0f2455",
        },
        "usfx-red": {
          DEFAULT: "#B71C1C",
          light:   "#fde8e8",
          dark:    "#7f1212",
        },
      },
    },
  },
  plugins: [],
};
