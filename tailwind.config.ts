import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17212b",
        paper: "#f7f8fa",
        line: "#d8dde5",
        sage: "#5d7668",
        brass: "#9a7b2f"
      }
    }
  },
  plugins: []
};

export default config;
