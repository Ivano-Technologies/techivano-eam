import { test, expect } from "@playwright/test";

/**
 * E2E: Supabase auth on production (techivano.com) or local (E2E_BASE_URL).
 * Credentials via env: E2E_AUTH_EMAIL, E2E_AUTH_PASSWORD.
 * Example: E2E_AUTH_EMAIL=test@techivano.com E2E_AUTH_PASSWORD=*** pnpm test:e2e:auth
 */
const base = process.env.E2E_BASE_URL ?? "https://techivano.com";

test.describe("Auth pages", () => {
  test("login, signup, forgot-password load with dark theme", async ({ page }) => {
    await page.goto(`${base}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await expect(page.getByRole("heading", { name: /Continue to NRCS/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: /^Continue$/i })).toBeVisible();

    await page.goto(`${base}/signup`, { waitUntil: "domcontentloaded", timeout: 15000 });
    await expect(page.getByRole("heading", { name: /Register for NRCS EAM/i })).toBeVisible({ timeout: 10000 });

    await page.goto(`${base}/forgot-password`, { waitUntil: "domcontentloaded", timeout: 15000 });
    await expect(page.getByRole("heading", { name: /Forgot Password/i })).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Supabase auth", () => {
  const email = process.env.E2E_AUTH_EMAIL;
  const password = process.env.E2E_AUTH_PASSWORD;

  test.beforeEach(() => {
    test.skip(!email || !password, "E2E_AUTH_EMAIL and E2E_AUTH_PASSWORD must be set");
  });

  test("sign in with email/password and land on home", async ({ page }) => {
    await page.goto(`${base}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });

    const emailInput = page.locator("#email").or(page.getByPlaceholder("your@email.com"));
    await emailInput.waitFor({ state: "visible", timeout: 15000 });
    await emailInput.fill(email!);

    const passwordInput = page.locator("#password").or(page.getByPlaceholder("Enter your password"));
    await passwordInput.fill(password!);

    await page.getByRole("button", { name: /^Continue$/i }).click();

    await expect(page).toHaveURL(/\/(\?.*)?$/, { timeout: 25000 });
    await expect(page.getByRole("button", { name: /^Continue$/i })).toHaveCount(0);
  });

  test("sign in → dashboard → logout (Phase 8 E2E)", async ({ page }) => {
    await page.goto(`${base}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });

    const emailInput = page.locator("#email").or(page.getByPlaceholder("your@email.com"));
    await emailInput.waitFor({ state: "visible", timeout: 15000 });
    await emailInput.fill(email!);
    const passwordInput = page.locator("#password").or(page.getByPlaceholder("Enter your password"));
    await passwordInput.fill(password!);
    await page.getByRole("button", { name: /^Continue$/i }).click();

    await expect(page).toHaveURL(/\/(\?.*)?$/, { timeout: 25000 });

    // Confirmed on home (not login)
    await expect(page).not.toHaveURL(/\/login/);

    // Logout when present (optional: some layouts show logout in user menu)
    const logoutBtn = page.getByRole("button", { name: /log out|sign out|logout/i }).or(
      page.getByRole("link", { name: /log out|sign out|logout/i })
    );
    if ((await logoutBtn.count()) > 0) {
      await logoutBtn.first().click();
      await expect(page).toHaveURL(/\/(login)?(\?.*)?$/, { timeout: 10000 });
    }
  });
});
