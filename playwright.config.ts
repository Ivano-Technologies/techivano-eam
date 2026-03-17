import { defineConfig, devices } from "@playwright/test";

// Use techivano.com (no www) so /api/trpc is same-origin; www may serve static-only and return HTML for API.
// For local e2e, set E2E_BASE_URL or rely on webServer (starts dev server on 3020).
const baseURL = process.env.E2E_BASE_URL ?? "https://techivano.com";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  // Start dev server when testing against localhost so auth e2e gets correct HTML + JS (avoids MIME/port mismatch).
  webServer:
    baseURL.startsWith("http://localhost") || baseURL.startsWith("http://127.0.0.1")
      ? {
          command: "pnpm dev",
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          env: { ...process.env, PORT: baseURL.match(/:(\d+)/)?.[1] ?? "3020" },
        }
      : undefined,
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
