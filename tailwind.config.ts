import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "var(--font-manrope)",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        heading: [
          "var(--font-sora)",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "var(--font-geist-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "monospace",
        ],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "2xl": "1.375rem",
        "3xl": "1.5rem",
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        limbi: {
          bg: "rgb(246 247 249 / <alpha-value>)",
          "bg-soft": "rgb(248 250 252 / <alpha-value>)",
          surface: "rgb(255 255 255 / <alpha-value>)",
          "surface-soft": "rgb(241 245 249 / <alpha-value>)",
          border: "rgb(232 238 242 / <alpha-value>)",
          text: "rgb(15 23 42 / <alpha-value>)",
          muted: "rgb(100 116 139 / <alpha-value>)",
          green: "rgb(16 185 129 / <alpha-value>)",
          aqua: "rgb(34 211 238 / <alpha-value>)",
          blue: "rgb(96 165 250 / <alpha-value>)",
          yellow: "rgb(245 158 11 / <alpha-value>)",
          red: "rgb(239 68 68 / <alpha-value>)",
        },
      },
      boxShadow: {
        limbi: "var(--limbi-shadow-card)",
        "limbi-hover": "var(--limbi-shadow-card-hover)",
        "limbi-primary": "var(--limbi-shadow-primary)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
