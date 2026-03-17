import { test, expect } from "@playwright/test";

/**
 * E2E: RBAC — viewer cannot mutate; admin can; member/manager boundaries; manager can create but not admin actions.
 * Requires: E2E_AUTH_EMAIL, E2E_AUTH_PASSWORD, TEST_ORG_ID. For admin test: E2E_ADMIN_EMAIL + E2E_ADMIN_PASSWORD.
 * For manager test: E2E_USER_ROLE=manager (primary user) or E2E_MANAGER_EMAIL + E2E_MANAGER_PASSWORD (second user).
 * Run seed-org-data with desired roles (e.g. E2E_USER_ROLE=viewer, E2E_ADMIN_EMAIL, E2E_MANAGER_EMAIL).
 */
const base = process.env.E2E_BASE_URL ?? "https://techivano.com";
const testOrgId = process.env.TEST_ORG_ID;
const isManagerPrimary = process.env.E2E_USER_ROLE === "manager";
const managerEmail = process.env.E2E_MANAGER_EMAIL ?? (isManagerPrimary ? process.env.E2E_AUTH_EMAIL : undefined);
const managerPassword = process.env.E2E_MANAGER_PASSWORD ?? (isManagerPrimary ? process.env.E2E_AUTH_PASSWORD : undefined);

async function loginAs(
  page: import("@playwright/test").Page,
  email: string,
  password: string
) {
  await page.goto(`${base}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
  const emailInput = page.locator("#email").or(page.getByPlaceholder("your@email.com"));
  await emailInput.waitFor({ state: "visible", timeout: 15000 });
  await emailInput.fill(email);
  const passwordInput = page.locator("#password").or(page.getByPlaceholder("Enter your password"));
  await passwordInput.fill(password);
  await page.getByRole("button", { name: /^Sign in$/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 25000 });
}

test.describe("RBAC", () => {
  const viewerEmail = process.env.E2E_AUTH_EMAIL;
  const viewerPassword = process.env.E2E_AUTH_PASSWORD;
  const adminEmail = process.env.E2E_ADMIN_EMAIL;
  const adminPassword = process.env.E2E_ADMIN_PASSWORD;

  test.beforeEach(({ page }) => {
    page.on("console", (msg) => {
      if (msg.type() === "error") console.log("BROWSER ERROR:", msg.text());
    });
  });

  test("viewer cannot create asset", async ({ page }) => {
    test.skip(!viewerEmail || !viewerPassword || !testOrgId, "E2E_AUTH_EMAIL, E2E_AUTH_PASSWORD, TEST_ORG_ID required");
    await loginAs(page, viewerEmail!, viewerPassword!);

    const res = await page.request.post(`${base}/api/trpc/assets.create`, {
      data: {
        assetTag: "e2e-rbac-asset",
        name: "E2E RBAC Test Asset",
        categoryId: 1,
        siteId: 1,
        status: "In Use",
      },
      headers: {
        "Content-Type": "application/json",
        "x-organization-id": testOrgId!,
      },
      failOnStatusCode: false,
    });
    expect(res.status(), "Viewer should get 403 when creating asset").toBe(403);
  });

  test("admin can create asset (or 400 if org has no sites/categories)", async ({ page }) => {
    test.skip(!adminEmail || !adminPassword || !testOrgId, "E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, TEST_ORG_ID required for admin test");
    await loginAs(page, adminEmail!, adminPassword!);

    const res = await page.request.post(`${base}/api/trpc/assets.create`, {
      data: {
        assetTag: "e2e-rbac-admin-asset",
        name: "E2E RBAC Admin Asset",
        categoryId: 1,
        siteId: 1,
        status: "In Use",
      },
      headers: {
        "Content-Type": "application/json",
        "x-organization-id": testOrgId!,
      },
      failOnStatusCode: false,
    });
    expect([200, 400]).toContain(res.status());
  });

  test("member cannot perform admin-only action (e.g. bulk delete sites)", async ({ page }) => {
    test.skip(!viewerEmail || !viewerPassword || !testOrgId, "E2E_AUTH_EMAIL, E2E_AUTH_PASSWORD, TEST_ORG_ID required");
    await loginAs(page, viewerEmail!, viewerPassword!);

    const res = await page.request.post(`${base}/api/trpc/sites.bulkDelete`, {
      data: { ids: [] },
      headers: {
        "Content-Type": "application/json",
        "x-organization-id": testOrgId!,
      },
      failOnStatusCode: false,
    });
    expect(res.status(), "Member/viewer should get 403 for sites.bulkDelete").toBe(403);
  });

  test("manager can create asset but cannot perform admin-only action", async ({ page }) => {
    test.skip(
      !managerEmail || !managerPassword || !testOrgId,
      "Manager test requires E2E_MANAGER_EMAIL + E2E_MANAGER_PASSWORD or E2E_USER_ROLE=manager with E2E_AUTH_EMAIL + E2E_AUTH_PASSWORD, and TEST_ORG_ID"
    );
    await loginAs(page, managerEmail!, managerPassword!);

    const createRes = await page.request.post(`${base}/api/trpc/assets.create`, {
      data: {
        assetTag: "e2e-rbac-manager-asset",
        name: "E2E RBAC Manager Asset",
        categoryId: 1,
        siteId: 1,
        status: "In Use",
      },
      headers: {
        "Content-Type": "application/json",
        "x-organization-id": testOrgId!,
      },
      failOnStatusCode: false,
    });
    expect([200, 400], "Manager should be able to create asset (200 or 400 if no sites/categories)").toContain(createRes.status());

    const inviteRes = await page.request.post(`${base}/api/trpc/sites.bulkDelete`, {
      data: { ids: [] },
      headers: {
        "Content-Type": "application/json",
        "x-organization-id": testOrgId!,
      },
      failOnStatusCode: false,
    });
    expect(inviteRes.status(), "Manager should get 403 for admin-only action (e.g. sites.bulkDelete)").toBe(403);
  });
});
