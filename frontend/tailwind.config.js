/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["Inter", "Segoe UI", "Arial", "sans-serif"] },
      colors: {
        brand: { DEFAULT: "#6366f1", dark: "#4f46e5" },
        surface: "#f8fafc",
        border: "#dbe4f0",
        muted: "#64748b",
        ink: "#0f172a",
      },
    },
  },
  plugins: [],
};
