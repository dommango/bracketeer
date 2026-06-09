import { defineConfig, devices } from "@playwright/test";

// E2E config. `npm run test:e2e` boots the dev server (with the dev DB + the two
// required secrets) and runs the specs in ./e2e against it. CI can override
// PLAYWRIGHT_BASE_URL to hit a deployed environment instead of booting locally.
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

const DEV_ENV = {
  DATABASE_URL:
    process.env.DATABASE_URL ??
    "postgresql://food_cost_user:food_cost_dev@localhost:5432/bracketeer",
  AUTH_SECRET: process.env.AUTH_SECRET ?? "dev-only-secret-at-least-32-characters-long",
  CRON_SECRET: process.env.CRON_SECRET ?? "dev-cron-secret",
  APP_BASE_URL: BASE_URL,
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Only boot a local server when not pointed at a remote base URL.
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: BASE_URL,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
        env: DEV_ENV,
      },
});
