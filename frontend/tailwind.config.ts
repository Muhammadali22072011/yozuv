import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        indigo: {
          50: "#EEF0FF",
          100: "#E0E4FF",
          200: "#C7CCFF",
          300: "#A3AAFF",
          500: "#5B6BFF",
          600: "#4853F5",
          700: "#3640D4",
          900: "#1E2270",
        },
        ink: {
          DEFAULT: "#0B0F1F",
          50: "#F8F9FC",
          100: "#F2F3F7",
          200: "#E3E5EC",
          300: "#B9BECD",
          400: "#848AA2",
          500: "#5A6078",
          700: "#2A2F45",
          900: "#0B0F1F",
        },
        mint: "#22C8A8",
        lemon: "#FFC94A",
        coral: "#FF7A6B",
        lilac: "#B8A6FF",
        sky: "#7BC6FF",
        rose: "#FF9FB5",
        "success-bg": "#E6FAF3",
        "warn-bg": "#FFF3DA",
        "danger-bg": "#FFE7E3",
        success: "#0E9577",
        warn: "#A8751A",
        danger: "#C93A2A",
        brand: "#4853F5",
        paper: "#FFFFFF",
        cream: "#F8F9FC",
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
      },
      fontFamily: {
        display: ["Plus Jakarta Sans", "var(--font-geist-sans)", "system-ui", "sans-serif"],
        sans: ["var(--font-geist-sans)", "Plus Jakarta Sans", "system-ui", "sans-serif"],
        serif: ["var(--font-geist-sans)", "Plus Jakarta Sans", "Georgia", "serif"],
        mono: ["SF Mono", "ui-monospace", "Menlo", "monospace"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "16px",
        "2xl": "22px",
        "3xl": "28px",
      },
      boxShadow: {
        soft: "0 1px 0 rgba(11,15,31,0.04), 0 6px 16px -8px rgba(11,15,31,0.08)",
        "soft-lg": "0 20px 40px -20px rgba(11,15,31,0.25), 0 1px 0 rgba(11,15,31,0.04)",
        indigo: "0 8px 24px rgba(72,83,245,0.35), inset 0 1px 0 rgba(255,255,255,0.25)",
      },
      keyframes: {
        sheetUp: {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        yzPulse: {
          "0%, 100%": { transform: "scale(0.9)", opacity: "0.55" },
          "50%": { transform: "scale(1.15)", opacity: "1" },
        },
        yzDot: {
          "0%, 80%, 100%": { transform: "scale(0.6)", opacity: "0.3" },
          "40%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        sheetUp: "sheetUp 320ms cubic-bezier(.32,.72,.2,1) both",
        fadeIn: "fadeIn 200ms ease both",
        "yz-pulse": "yzPulse 1.6s ease-in-out infinite",
        "yz-dot": "yzDot 1.1s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
