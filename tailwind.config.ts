import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        klipio: {
          bg: "#F7F6FB",
          surface: "#FFFFFF",
          "surface-hover": "#EFEAFB",
          "surface-elevated": "#F0EEF7",
          primary: "#3A2DE0",
          "primary-hover": "#2E24BF",
          secondary: "#9B7BFF",
          accent: "#9B7BFF",
          "accent-light": "#C8B7FF",
          text: "#141221",
          muted: "#75727F",
          "muted-light": "#9B98A4",
          success: "#257A4A",
          "success-light": "#37A56A",
          danger: "#D22D2D",
          "danger-light": "#EF5B5B",
          warning: "#B77700",
          border: "#DFDDE7",
          "border-hover": "#C8C4D4",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      animation: {
        "gradient-shift": "gradient-shift 8s ease infinite",
        "float": "float 6s ease-in-out infinite",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "shimmer": "shimmer 2s linear infinite",
        "fade-in": "fade-in 0.5s ease-out",
        "fade-in-up": "fade-in-up 0.5s ease-out",
        "scale-in": "scale-in 0.3s ease-out",
        "slide-in-right": "slide-in-right 0.4s ease-out",
        "slide-in-left": "slide-in-left 0.4s ease-out",
        "slide-in-up": "slide-in-up 0.4s ease-out",
        "bounce-subtle": "bounce-subtle 2s ease-in-out infinite",
        "spin-slow": "spin 3s linear infinite",
        "progress": "progress 2s ease-in-out infinite",
        "particle": "particle 20s linear infinite",
      },
      keyframes: {
        "gradient-shift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-20px)" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.5", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.05)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.9)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "slide-in-right": {
          "0%": { opacity: "0", transform: "translateX(20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "slide-in-left": {
          "0%": { opacity: "0", transform: "translateX(-20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "slide-in-up": {
          "0%": { opacity: "0", transform: "translateY(40px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "bounce-subtle": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-5px)" },
        },
        progress: {
          "0%": { width: "0%" },
          "50%": { width: "70%" },
          "100%": { width: "100%" },
        },
        particle: {
          "0%": { transform: "translateY(100vh) translateX(0)", opacity: "0" },
          "10%": { opacity: "1" },
          "90%": { opacity: "1" },
          "100%": { transform: "translateY(-100vh) translateX(100px)", opacity: "0" },
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "gradient-klipio": "linear-gradient(135deg, #F7F6FB 0%, #FFFFFF 52%, #EFEAFB 100%)",
        "gradient-purple": "linear-gradient(135deg, #3A2DE0 0%, #9B7BFF 100%)",
        "gradient-glow": "radial-gradient(ellipse at center, rgba(58,45,224,0.12) 0%, transparent 70%)",
      },
      borderRadius: {
        lg: "1rem",
        xl: "1.25rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
      },
      boxShadow: {
        glow: "0 16px 46px rgba(58,45,224,0.22)",
        "glow-sm": "0 10px 28px rgba(58,45,224,0.16)",
        "glow-lg": "0 26px 70px rgba(58,45,224,0.24)",
        "inner-glow": "inset 0 0 40px rgba(58,45,224,0.08)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
