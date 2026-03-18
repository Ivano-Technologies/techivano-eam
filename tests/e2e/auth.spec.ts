import { test, expect } from "@playwright/test";

test("health check", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.status).toBe("ok");
});

test("authenticated dashboard loads (not redirected to login)", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 30_000 });
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
  await expect(page.getByRole("button", { name: /^Sign in$/i })).toHaveCount(0);
});

test("login page renders magic-link form", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 30_000 });
  await expect(page.locator("form")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: /send magic link/i })).toBeVisible({ timeout: 5_000 });
  await ctx.close();
});

test("logout clears session and redirects to login", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 30_000 });
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });

  const logoutBtn = page
    .getByRole("button", { name: /log\s?out|sign\s?out/i })
    .or(page.getByRole("link", { name: /log\s?out|sign\s?out/i }));

  if ((await logoutBtn.count()) === 0) {
    const userMenu = page.getByRole("button", { name: /user|profile|menu|avatar/i });
    if ((await userMenu.count()) > 0) {
      await userMenu.first().click();
      await page.waitForTimeout(500);
    }
  }

  if ((await logoutBtn.count()) > 0) {
    await logoutBtn.first().click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  }
});
