import { defineConfig, devices } from "@playwright/test";

/* E2E runs against a seeded database (local Docker Postgres by default) with
   third-party calls stubbed in-process. Approval / reset links are read from the
   email_outbox table through the /dev/mailbox page. */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: process.env.E2E_START === "start" ? "pnpm start" : "pnpm dev",
        url: "http://localhost:3000/api/health",
        reuseExistingServer: true,
        timeout: 120_000,
        env: { EMAIL_TRANSPORT: "outbox", INTEGRATIONS_MOCK: "1", AI_MOCK: "1", LOGIN_RATE_LIMIT: "200", ALLOW_DEV_MAILBOX: "1" },
      },
});
