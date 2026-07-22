import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#FFFFFF",
        paper: "#000000",
        line: "#27272A",
        sage: "#FFD60A",
        brass: "#FFB800"
      }
    }
  },
  plugins: []
};

export default config;
