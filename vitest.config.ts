import { defineConfig } from "vitest/config";
import path from "path";
import os from "os";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    env: {
      DATABASE_PATH: path.join(os.tmpdir(), `ai-financials-test-${Date.now()}.db`),
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
