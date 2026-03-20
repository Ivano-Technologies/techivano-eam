import { expect, test } from "@playwright/test";

function toCookieHeader(setCookies: string[]): string {
  return setCookies
    .map((cookie) => cookie.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");
}

test.describe("Serverless auth and API smoke", () => {
  test("magic-link verify API returns JSON error for missing token", async ({ request }) => {
    const response = await request.post("/api/auth/verify-magic-link", {
      data: {},
      failOnStatusCode: false,
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty("success", false);
    expect(typeof body.message).toBe("string");
  });

  test("oauth start endpoint never leaks tokens in redirect URL", async ({ request }) => {
    const response = await request.get("/api/auth/google?remember=1", {
      failOnStatusCode: false,
      maxRedirects: 0,
    });
    expect([200, 302, 400]).toContain(response.status());
    const location = response.headers()["location"] ?? "";
    const finalUrl = response.url();
    expect(location).not.toMatch(/access_token=|refresh_token=|id_token=/i);
    expect(finalUrl).not.toMatch(/access_token=|refresh_token=|id_token=/i);
  });

  test("oauth callback error path never leaks tokens in URL", async ({ request }) => {
    const response = await request.get("/api/auth/google/callback?code=fake&state=bad-state", {
      failOnStatusCode: false,
      maxRedirects: 0,
    });
    expect([200, 302, 400]).toContain(response.status());
    const location = response.headers()["location"] ?? "";
    const finalUrl = response.url();
    expect(location).not.toMatch(/access_token=|refresh_token=|id_token=/i);
    expect(finalUrl).not.toMatch(/access_token=|refresh_token=|id_token=/i);
  });

  test("oauth callback success establishes secure session and unlocks protected API", async ({
    request,
    baseURL,
  }) => {
    const origin = baseURL ?? "http://localhost:33123";
    const state = Buffer.from(
      JSON.stringify({ remember: "1", origin }),
      "utf8"
    ).toString("base64url");

    const callbackResponse = await request.get(
      `/api/auth/google/callback?code=e2e-oauth-success&state=${state}`,
      {
        failOnStatusCode: false,
        maxRedirects: 0,
        headers: {
          "x-forwarded-host": "localhost:33123",
          "x-forwarded-proto": "https",
        },
      }
    );

    expect(callbackResponse.status()).toBe(302);
    const location = callbackResponse.headers()["location"] ?? "";
    expect(location).toContain("/");
    expect(location).not.toMatch(/access_token=|refresh_token=|id_token=/i);

    const setCookies = callbackResponse
      .headersArray()
      .filter((header) => header.name.toLowerCase() === "set-cookie")
      .map((header) => header.value);
    expect(setCookies.length).toBeGreaterThanOrEqual(1);
    expect(setCookies.some((cookie) => cookie.includes("HttpOnly"))).toBe(true);
    expect(setCookies.some((cookie) => cookie.includes("SameSite=Lax"))).toBe(true);
    expect(setCookies.some((cookie) => cookie.includes("Secure"))).toBe(true);

    const cookieHeader = toCookieHeader(setCookies);
    expect(cookieHeader).toContain("app_session_id=");

    const firstProtectedCall = await request.get("/api/test/protected", {
      failOnStatusCode: false,
      headers: {
        cookie: cookieHeader,
      },
    });
    expect(firstProtectedCall.status()).toBe(200);

    // Ensure session persists across requests.
    const secondProtectedCall = await request.get("/api/test/protected", {
      failOnStatusCode: false,
      headers: {
        cookie: cookieHeader,
      },
    });
    expect(secondProtectedCall.status()).toBe(200);
  });
});
