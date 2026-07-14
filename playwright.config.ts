import { defineConfig, devices } from "@playwright/test";

if (!process.env.DATABASE_URL_TEST) {
  throw new Error(
    "E2E tests require DATABASE_URL_TEST environment variable.\n" +
    "Set it in .env.local or export it before running:\n" +
    "  export DATABASE_URL_TEST=postgresql://..."
  );
}

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
    command: `pnpm exec next dev -p 3100`,
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    cwd: ".",
    env: {
      DATABASE_URL: process.env.DATABASE_URL_TEST,
    },
  },
});
