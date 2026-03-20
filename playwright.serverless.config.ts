import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:33123";
const port = baseURL.match(/:(\d+)/)?.[1] ?? "33123";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /serverless-auth\.spec\.ts/,
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
  webServer:
    baseURL.startsWith("http://localhost") || baseURL.startsWith("http://127.0.0.1")
      ? {
          command: "pnpm tsx server/_core/index.ts",
          url: `${baseURL}/login`,
          reuseExistingServer: true,
          timeout: 180_000,
          env: {
            ...process.env,
            PORT: port,
            NODE_ENV: "test",
            OAUTH_E2E_MOCK: "1",
            ENABLE_TEST_AUTH: "true",
            SUPABASE_JWT_SECRET:
              process.env.SUPABASE_JWT_SECRET ?? "test_supabase_jwt_secret_32_characters_min",
          },
        }
      : undefined,
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
