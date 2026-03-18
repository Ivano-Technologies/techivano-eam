import { test, expect } from "@playwright/test";

/**
 * E2E: Auth pages and Supabase sign-in.
 * - E2E_BASE_URL: EAM app URL; must match the dev server port (e.g. http://localhost:3003 when server says "Server running on http://localhost:3003/").
 *   For auth E2E against a deployed subdomain, set E2E_BASE_URL to that host (e.g. E2E_BASE_URL=https://nrcseam.techivano.com).
 *   Default https://techivano.com may serve the marketing page; use a subdomain or localhost so the login form is present.
 * - E2E_AUTH_EMAIL, E2E_AUTH_PASSWORD: optional; when set, sign-in and logout tests run.
 *
 * MFA: Use an E2E_AUTH_EMAIL that is NOT a global owner (see server _core/env GLOBAL_OWNER_EMAILS),
 * so MFA is never required and tests do not hit /mfa/setup or /mfa/verify. To run E2E with a global
 * owner account, set E2E_MFA_BYPASS=1 so requireMFA is skipped in test env.
 *
 * The dev server must return JavaScript for GET /src/main.tsx and GET /@vite/client (not HTML). If the form never appears or you see "MIME type text/html", restart the dev server and run the test with the same port.
 *
 * Bash:  E2E_BASE_URL=http://localhost:3003 pnpm test:e2e:auth
 * PowerShell: $env:E2E_BASE_URL="http://localhost:3003"; pnpm test:e2e:auth
 * Subdomain: E2E_BASE_URL=https://nrcseam.techivano.com E2E_AUTH_EMAIL=... E2E_AUTH_PASSWORD=... pnpm test:e2e:auth
 * Or: pnpm test:e2e:auth:local (port 3000), pnpm test:e2e:auth:fresh (starts server on 31998).
 */
const base = process.env.E2E_BASE_URL ?? "https://techivano.com";

test.describe("Auth pages", () => {
  test("login, signup, forgot-password load with dark theme", async ({ page }, testInfo) => {
    const consoleLogs: string[] = [];
    page.on("console", (msg) => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
    const res = await page.goto(`${base}/login`, { waitUntil: "load", timeout: 30000 });
    expect(res?.status(), "GET /login should return 200").toBe(200);
    const body = await page.content();
    if (body.trim().startsWith("{")) {
      throw new Error(`Server returned JSON instead of HTML. Body: ${body.slice(0, 200)}. Check server logs for "[vite] SPA serve error".`);
    }
    const formVisible = await page.locator("form").isVisible().catch(() => false);
    if (!formVisible) {
      await testInfo.attach("console", { body: consoleLogs.join("\n"), contentType: "text/plain" });
      await testInfo.attach("root-innerHTML", {
        body: (await page.locator("#root").innerHTML().catch(() => "(no #root)")).slice(0, 8000),
        contentType: "text/html",
      });
    }
    await expect(page.locator("form")).toBeVisible({ timeout: 55000 });
    await expect(page.getByRole("button", { name: /^Sign in$/i })).toBeVisible({ timeout: 10000 });

    await page.goto(`${base}/signup`, { waitUntil: "domcontentloaded", timeout: 15000 });
    await expect(page.locator("form")).toBeVisible({ timeout: 10000 });

    await page.goto(`${base}/forgot-password`, { waitUntil: "domcontentloaded", timeout: 15000 });
    await expect(page.getByRole("heading", { name: /Forgot Password|Reset password/i })).toBeVisible({ timeout: 10000 });
  });

  test("Google sign-in option is visible on login page", async ({ page }) => {
    await page.goto(`${base}/login`, { waitUntil: "domcontentloaded", timeout: 15000 });
    await expect(page.getByText(/continue with google/i)).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Supabase auth", () => {
  const email = process.env.E2E_AUTH_EMAIL;
  const password = process.env.E2E_AUTH_PASSWORD;

  test.beforeEach(() => {
    test.skip(!email || !password, "E2E_AUTH_EMAIL and E2E_AUTH_PASSWORD must be set");
  });

  test("sign in with email/password and land on home", async ({ page }) => {
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        console.log("BROWSER ERROR:", msg.text());
      }
    });
    await page.goto(`${base}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });

    const emailInput = page.locator("#email").or(page.getByPlaceholder("your@email.com"));
    await emailInput.waitFor({ state: "visible", timeout: 15000 });
    await emailInput.fill(email!);

    const passwordInput = page.locator("#password").or(page.getByPlaceholder("Enter your password"));
    await passwordInput.fill(password!);

    // Wait for backend auth response so we assert real session, not just UI
    const trpcResponse = page.waitForResponse(
      (res) => res.url().includes("/api/trpc") && res.status() === 200,
      { timeout: 20000 }
    );
    await page.getByRole("button", { name: /^Sign in$/i }).click();

    await trpcResponse;
    await expect(page).toHaveURL(/\/(\?.*)?$/, { timeout: 25000 });
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole("button", { name: /^Sign in$/i })).toHaveCount(0);
  });

  test("sign in → dashboard → logout (Phase 8 E2E)", async ({ page }) => {
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        console.log("BROWSER ERROR:", msg.text());
      }
    });
    await page.goto(`${base}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });

    const emailInput = page.locator("#email").or(page.getByPlaceholder("your@email.com"));
    await emailInput.waitFor({ state: "visible", timeout: 15000 });
    await emailInput.fill(email!);
    const passwordInput = page.locator("#password").or(page.getByPlaceholder("Enter your password"));
    await passwordInput.fill(password!);

    const trpcResponse = page.waitForResponse(
      (res) => res.url().includes("/api/trpc") && res.status() === 200,
      { timeout: 20000 }
    );
    await page.getByRole("button", { name: /^Sign in$/i }).click();

    await trpcResponse;
    await expect(page).toHaveURL(/\/(\?.*)?$/, { timeout: 25000 });
    await expect(page).not.toHaveURL(/\/login/);

    const cookies = await page.context().cookies();
    const hasSessionCookie = cookies.some(
      (c) =>
        ["app_session_id", "sb-auth-token"].includes(c.name) || c.name.startsWith("sb-")
    );
    expect(hasSessionCookie, "Expected a session cookie after login").toBeTruthy();

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

/** OAuth bypass: inject Supabase session as cookie instead of automating Google login. */
test.describe("OAuth-equivalent (session injection)", () => {
  test.beforeEach(({ page }) => {
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        console.log("BROWSER ERROR:", msg.text());
      }
    });
  });

  test("injected session is accepted and protected routes work", async ({ page }) => {
    const raw = process.env.TEST_SESSION;
    test.skip(!raw, "TEST_SESSION not set (run create-test-session.ts and pass output as TEST_SESSION)");

    const session = JSON.parse(raw!) as { access_token: string };
    const accessToken = session.access_token;
    if (!accessToken) {
      throw new Error("TEST_SESSION must contain access_token");
    }

    const url = new URL(base);
    const domain = url.hostname || "localhost";

    await page.context().addCookies([
      {
        name: "app_session_id",
        value: accessToken,
        domain,
        path: "/",
        httpOnly: true,
        secure: url.protocol === "https:",
        sameSite: "Lax",
      },
    ]);

    const authMePromise = page.waitForResponse(
      (res) => res.url().includes("auth.me") && res.status() === 200,
      { timeout: 15000 }
    );
    await page.goto(base, { waitUntil: "domcontentloaded", timeout: 30000 });
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole("button", { name: /^Sign in$/i })).toHaveCount(0);

    const authMeRes = await authMePromise;
    const body = await authMeRes.json();
    const user = body?.result?.data?.json ?? body?.result?.data;
    expect(user).toBeTruthy();
    expect(user?.email).toBe(process.env.E2E_AUTH_EMAIL);
  });
});

/** Multi-tenant: user sees only their org; cross-tenant access is rejected or empty. */
test.describe("Multi-tenant auth", () => {
  const email = process.env.E2E_AUTH_EMAIL;
  const password = process.env.E2E_AUTH_PASSWORD;
  const testOrgId = process.env.TEST_ORG_ID;

  test.beforeEach(({ page }) => {
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        console.log("BROWSER ERROR:", msg.text());
      }
    });
  });

  test("user only sees their organization data", async ({ page }) => {
    test.skip(!email || !password, "E2E_AUTH_EMAIL and E2E_AUTH_PASSWORD must be set");

    await page.goto(`${base}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
    const emailInput = page.locator("#email").or(page.getByPlaceholder("your@email.com"));
    await emailInput.waitFor({ state: "visible", timeout: 15000 });
    await emailInput.fill(email!);
    const passwordInput = page.locator("#password").or(page.getByPlaceholder("Enter your password"));
    await passwordInput.fill(password!);
    await page.getByRole("button", { name: /^Sign in$/i }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 25000 });

    await page.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 15000 });
    await expect(page).not.toHaveURL(/\/login/);

    if (testOrgId) {
      const assetsWithOrg = await page.locator("[data-org-id]").all();
      for (const el of assetsWithOrg) {
        const orgId = await el.getAttribute("data-org-id");
        expect(orgId).toBe(testOrgId);
      }
    }
  });

  test("cannot access another organization (cross-tenant)", async ({ page }) => {
    test.skip(!email || !password, "E2E_AUTH_EMAIL and E2E_AUTH_PASSWORD must be set");

    await page.goto(`${base}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
    const emailInput = page.locator("#email").or(page.getByPlaceholder("your@email.com"));
    await emailInput.waitFor({ state: "visible", timeout: 15000 });
    await emailInput.fill(email!);
    const passwordInput = page.locator("#password").or(page.getByPlaceholder("Enter your password"));
    await passwordInput.fill(password!);
    await page.getByRole("button", { name: /^Sign in$/i }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 25000 });

    const otherOrgId = "00000000-0000-4000-8000-000000000001";
    const res = await page.request.get(`${base}/api/trpc/nrcs.getBranchCodes`, {
      headers: { "x-organization-id": otherOrgId },
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(403);
  });

  test("request without org header is rejected", async ({ page }) => {
    test.skip(!email || !password, "E2E_AUTH_EMAIL and E2E_AUTH_PASSWORD must be set");

    await page.goto(`${base}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
    const emailInput = page.locator("#email").or(page.getByPlaceholder("your@email.com"));
    await emailInput.waitFor({ state: "visible", timeout: 15000 });
    await emailInput.fill(email!);
    const passwordInput = page.locator("#password").or(page.getByPlaceholder("Enter your password"));
    await passwordInput.fill(password!);
    await page.getByRole("button", { name: /^Sign in$/i }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 25000 });

    const res = await page.request.get(`${base}/api/trpc/assets.list`, {
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(400);
  });
});

/** Session validity: invalid or expired token must not grant access. */
test.describe("Session validity", () => {
  const email = process.env.E2E_AUTH_EMAIL;
  const password = process.env.E2E_AUTH_PASSWORD;

  test.beforeEach(({ page }) => {
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        console.log("BROWSER ERROR:", msg.text());
      }
    });
  });

  test("expired or invalid session is rejected", async ({ page }) => {
    test.skip(!email || !password, "E2E_AUTH_EMAIL and E2E_AUTH_PASSWORD must be set");

    await page.goto(`${base}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
    const emailInput = page.locator("#email").or(page.getByPlaceholder("your@email.com"));
    await emailInput.waitFor({ state: "visible", timeout: 15000 });
    await emailInput.fill(email!);
    const passwordInput = page.locator("#password").or(page.getByPlaceholder("Enter your password"));
    await passwordInput.fill(password!);
    await page.getByRole("button", { name: /^Sign in$/i }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 25000 });

    const url = new URL(base);
    const domain = url.hostname || "localhost";
    await page.context().addCookies([
      {
        name: "app_session_id",
        value: "invalid",
        domain,
        path: "/",
      },
    ]);

    await page.goto(base, { waitUntil: "domcontentloaded", timeout: 15000 });
    await expect(page).toHaveURL(/\/login/);
  });
});

/** Impersonation: global owner can start/stop and sees banner. */
test.describe("Impersonation", () => {
  const ownerEmail = process.env.E2E_OWNER_EMAIL ?? process.env.E2E_AUTH_EMAIL;
  const ownerPassword = process.env.E2E_OWNER_PASSWORD ?? process.env.E2E_AUTH_PASSWORD;
  const targetUserId = process.env.E2E_TARGET_USER_ID;

  test.beforeEach(({ page }) => {
    page.on("console", (msg) => {
      if (msg.type() === "error") console.log("BROWSER ERROR:", msg.text());
    });
  });

  test("impersonation works and is reversible", async ({ page }) => {
    test.skip(!ownerEmail || !ownerPassword || !targetUserId, "E2E_OWNER_EMAIL, E2E_OWNER_PASSWORD, E2E_TARGET_USER_ID (Supabase uuid) must be set");

    await page.goto(`${base}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
    const emailInput = page.locator("#email").or(page.getByPlaceholder("your@email.com"));
    await emailInput.waitFor({ state: "visible", timeout: 15000 });
    await emailInput.fill(ownerEmail!);
    const passwordInput = page.locator("#password").or(page.getByPlaceholder("Enter your password"));
    await passwordInput.fill(ownerPassword!);
    await page.getByRole("button", { name: /^Sign in$/i }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 25000 });

    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) => c.name === "app_session_id");
    test.skip(!sessionCookie?.value, "No session cookie after login");

    const trpcUrl = `${base}/api/trpc/impersonation.startImpersonation?input=${encodeURIComponent(JSON.stringify({ json: { targetUserId } }))}`;
    const startRes = await page.request.post(trpcUrl, {
      headers: { Cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; ") },
      timeout: 15000,
    });
    expect(startRes.ok()).toBeTruthy();
    const startBody = await startRes.json();
    const token = startBody?.result?.data?.json?.impersonationToken ?? startBody?.result?.data?.impersonationToken;
    test.skip(!token, "startImpersonation did not return a token");

    await page.evaluate((t) => sessionStorage.setItem("impersonation_token", t), token);
    await page.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 15000 });
    await expect(page.getByText(/impersonating/i)).toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: /stop impersonating/i }).click();
    await expect(page.getByText(/impersonating/i)).not.toBeVisible({ timeout: 5000 });
  });
});

/** Session revoke: revoked session cannot be used. */
test.describe("Session revoke", () => {
  const email = process.env.E2E_AUTH_EMAIL;
  const password = process.env.E2E_AUTH_PASSWORD;

  test.beforeEach(({ page }) => {
    page.on("console", (msg) => {
      if (msg.type() === "error") console.log("BROWSER ERROR:", msg.text());
    });
  });

  test("revoked session cannot be used", async ({ page }) => {
    test.skip(!email || !password, "E2E_AUTH_EMAIL and E2E_AUTH_PASSWORD must be set");

    await page.goto(`${base}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
    const emailInput = page.locator("#email").or(page.getByPlaceholder("your@email.com"));
    await emailInput.waitFor({ state: "visible", timeout: 15000 });
    await emailInput.fill(email!);
    const passwordInput = page.locator("#password").or(page.getByPlaceholder("Enter your password"));
    await passwordInput.fill(password!);
    await page.getByRole("button", { name: /^Sign in$/i }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 25000 });

    const cookies = await page.context().cookies();
    const trpcUrl = `${base}/api/trpc/sessions.revokeCurrent`;
    await page.request.post(trpcUrl, {
      headers: { Cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; ") },
      timeout: 10000,
    });

    await page.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 15000 });
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});
