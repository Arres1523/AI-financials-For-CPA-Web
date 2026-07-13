import { defineConfig, devices } from "@playwright/test";

const DB_PATH = process.env.E2E_DB_PATH || `/tmp/ai-financials-e2e-${Date.now()}.db`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `DATABASE_PATH=${DB_PATH} pnpm exec next dev -p 3100`,
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    cwd: ".",
  },
});
