import { test, expect } from "@playwright/test";

/**
 * E2E: Supabase auth on production (techivano.com).
 * Credentials via env: E2E_AUTH_EMAIL, E2E_AUTH_PASSWORD.
 * Example: E2E_AUTH_EMAIL=test@techivano.com E2E_AUTH_PASSWORD=*** pnpm test:e2e:auth
 */
test.describe("Supabase auth", () => {
  const email = process.env.E2E_AUTH_EMAIL;
  const password = process.env.E2E_AUTH_PASSWORD;

  test.beforeEach(() => {
    test.skip(!email || !password, "E2E_AUTH_EMAIL and E2E_AUTH_PASSWORD must be set");
  });

  test("sign in with email/password and land on home", async ({ page }) => {
    const base = process.env.E2E_BASE_URL ?? "https://www.techivano.com";
    await page.goto(`${base}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });

    const emailInput = page.locator("#email").or(page.getByPlaceholder("your@email.com"));
    await emailInput.waitFor({ state: "visible", timeout: 15000 });
    await emailInput.fill(email!);

    const passwordInput = page.locator("#password").or(page.getByPlaceholder("Enter your password"));
    await passwordInput.fill(password!);

    await page.getByRole("button", { name: /^Sign In$/i }).click();

    await expect(page).toHaveURL(/\/(\?.*)?$/, { timeout: 25000 });
    await expect(page.getByRole("button", { name: /^Sign In$/i })).toHaveCount(0);
  });
});
