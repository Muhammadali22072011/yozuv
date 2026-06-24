import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ── Brand: indigo остаётся фирменным. Утончены крайние оттенки,
        //    добавлены 400/800 и акцент iris для премиальных градиентов.
        indigo: {
          50: "#EEF0FF",
          100: "#E0E4FF",
          200: "#C7CCFF",
          300: "#A3AAFF",
          400: "#7C84FF",
          500: "#5B6BFF",
          600: "#4853F5",
          700: "#3640D4",
          800: "#2A2E9E",
          900: "#1E2270",
        },
        iris: "#7C5CFF",
        ink: {
          DEFAULT: "#0B0F1F",
          50: "#F5F6FB",
          100: "#F1F2F8",
          200: "#E5E7F0",
          300: "#B9BECD",
          400: "#878DA6",
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
        "success-bg": "#E7F8F2",
        "warn-bg": "#FFF4DD",
        "danger-bg": "#FFE9E5",
        success: "#0E9577",
        warn: "#A8751A",
        danger: "#C93A2A",
        brand: "#4853F5",
        paper: "#FFFFFF",
        cream: "#F5F6FB",
        canvas: "#F5F6FB",
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
      },
      fontFamily: {
        display: ["Plus Jakarta Sans", "var(--font-geist)", "system-ui", "sans-serif"],
        sans: ["var(--font-geist)", "Plus Jakarta Sans", "system-ui", "sans-serif"],
        serif: ["var(--font-geist)", "Plus Jakarta Sans", "Georgia", "serif"],
        mono: ["Spline Sans Mono", "SF Mono", "ui-monospace", "Menlo", "monospace"],
      },
      // Единая шкала отступов/радиусов — мягкие, крупные («дружелюбный» продукт).
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "16px",
        "2xl": "22px",
        "3xl": "28px",
        "4xl": "32px",
      },
      letterSpacing: {
        tightest: "-0.03em",
        tighter: "-0.022em",
      },
      // Многослойные мягкие тени — близкий контактный слой + длинный
      //    рассеянный. Дают «воздушную» глубину без грязи.
      boxShadow: {
        "soft-sm": "0 1px 2px rgba(11,15,31,0.05), 0 4px 12px -6px rgba(11,15,31,0.10)",
        soft: "0 1px 2px rgba(11,15,31,0.04), 0 10px 26px -14px rgba(11,15,31,0.16)",
        "soft-lg": "0 2px 4px rgba(11,15,31,0.05), 0 28px 56px -26px rgba(11,15,31,0.30)",
        indigo: "0 12px 28px -10px rgba(72,83,245,0.45), inset 0 1px 0 rgba(255,255,255,0.22)",
        "indigo-sm": "0 8px 18px -6px rgba(72,83,245,0.5)",
        glow: "0 0 0 1px rgba(72,83,245,0.08), 0 18px 40px -18px rgba(72,83,245,0.4)",
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
        // Появление карточек: лёгкий подъём + проявление.
        cardIn: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        popIn: {
          "0%": { opacity: "0", transform: "scale(0.94)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        floaty: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
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
        fadeIn: "fadeIn 220ms ease both",
        "card-in": "cardIn 420ms cubic-bezier(.22,.7,.2,1) both",
        "pop-in": "popIn 280ms cubic-bezier(.32,.72,.2,1) both",
        shimmer: "shimmer 1.6s infinite",
        floaty: "floaty 5s ease-in-out infinite",
        "yz-pulse": "yzPulse 1.6s ease-in-out infinite",
        "yz-dot": "yzDot 1.1s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
