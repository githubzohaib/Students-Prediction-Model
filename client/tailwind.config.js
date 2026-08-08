/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}", "./index.html"],
  theme: {
    extend: {
      colors: {
        page: "var(--page)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        "surface-3": "var(--surface-3)",
        ink: "var(--ink)",
        "ink-2": "var(--ink-2)",
        muted: "var(--muted)",
        grid: "var(--grid)",
        baseline: "var(--baseline)",
        hairline: "var(--border)",
        "hairline-strong": "var(--border-strong)",
        "series-1": "var(--series-1)",
        "series-2": "var(--series-2)",
        "series-3": "var(--series-3)",
        good: "var(--good)",
        warning: "var(--warning)",
        serious: "var(--serious)",
        critical: "var(--critical)",
        "success-text": "var(--success-text)",
        accent: "var(--accent)",
        "accent-2": "var(--accent-2)",
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 6px)",
        sm: "calc(var(--radius) - 8px)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        glow: "var(--shadow-glow)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.97)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.28s ease-out both",
        "scale-in": "scale-in 0.2s ease-out both",
      },
    },
  },
  plugins: [],
};
