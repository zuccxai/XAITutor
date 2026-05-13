import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./hooks/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "var(--surface)",
        borderline: "var(--borderline)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        accent: "var(--accent)",
        warning: "var(--warning)",
        danger: "var(--danger)"
      },
      boxShadow: {
        panel: "0 1px 2px rgba(15, 23, 42, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
