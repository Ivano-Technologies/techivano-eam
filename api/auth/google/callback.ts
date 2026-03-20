/**
 * Custom Google OAuth callback — exchanges code for Google id_token,
 * then creates a Supabase session via signInWithIdToken.
 * Session tokens are set as HttpOnly cookies (never in URL query params).
 * @see docs/GOOGLE_OAUTH_CLIENT_NAME.md
 */
import type { IncomingMessage, ServerResponse } from "http";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import { COOKIE_NAME, REFRESH_TOKEN_COOKIE_NAME } from "@shared/const";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_COOKIE_MAX_AGE_SEC = 365 * 24 * 60 * 60;

/** Host header (hostname:port) — must match redirect_uri used in the initial OAuth request. */
function getHostHeader(req: IncomingMessage): string {
  const raw =
    (req.headers["x-forwarded-host"] as string) ||
    (Array.isArray(req.headers.host) ? req.headers.host[0] : req.headers.host) ||
    "";
  return raw.trim();
}

function getClientCreds(): { clientId: string; clientSecret: string } | null {
  const id = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  return id && secret ? { clientId: id, clientSecret: secret } : null;
}

/** Match server cookie security: Secure when HTTPS (or production). */
function isSecureCookieContext(req: IncomingMessage): boolean {
  if (process.env.NODE_ENV === "production") return true;
  const raw = req.headers["x-forwarded-proto"];
  const first = (Array.isArray(raw) ? raw[0] : raw)?.split(",")[0]?.trim().toLowerCase();
  return first === "https";
}

/**
 * Build a single Set-Cookie value (RFC 6265). Values are URL-encoded.
 * httpOnly + SameSite=Lax; Secure when context is HTTPS (required for production).
 */
function buildHttpOnlyCookie(
  name: string,
  value: string,
  opts: { maxAgeSec?: number; secure: boolean }
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Lax"];
  if (opts.secure) parts.push("Secure");
  if (opts.maxAgeSec != null && Number.isFinite(opts.maxAgeSec) && opts.maxAgeSec > 0) {
    parts.push(`Max-Age=${Math.floor(opts.maxAgeSec)}`);
  }
  return parts.join("; ");
}

async function exchangeCodeForIdToken(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    await res.text().catch(() => {});
    throw new Error(`Google token exchange failed: ${res.status}`);
  }
  const data = (await res.json()) as { id_token?: string };
  if (!data.id_token) throw new Error("Google response missing id_token");
  return data.id_token;
}

/**
 * CI-safe OAuth success-path mock:
 * - enabled only in test runtime with OAUTH_E2E_MOCK=1
 * - never enabled in production
 * - mints a JWT signed with SUPABASE_JWT_SECRET so backend auth verifies it
 */
function buildMockSupabaseAccessToken(params: {
  secret: string;
  email: string;
  sub: string;
  issuer?: string;
  audience?: string;
}): string {
  return jwt.sign(
    {
      sub: params.sub,
      email: params.email,
      role: "authenticated",
      aud: params.audience ?? "authenticated",
      iss: params.issuer,
    },
    params.secret,
    {
      algorithm: "HS256",
      expiresIn: "1h",
    }
  );
}

function isExplicitTestAuthEnabled(): boolean {
  return process.env.ENABLE_TEST_AUTH === "true";
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.statusCode = 405;
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", `https://${req.headers.host ?? "localhost"}`);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    res.writeHead(302, {
      Location: "/login?error=missing_params",
    });
    res.end();
    return;
  }

  let parsedState: { remember?: string; origin?: string };
  try {
    parsedState = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
  } catch {
    res.writeHead(302, { Location: "/login?error=invalid_state" });
    res.end();
    return;
  }

  const origin = parsedState.origin || "";
  const remember = parsedState.remember === "1";
  const hostHeader = getHostHeader(req);
  const creds = getClientCreds();

  if (!creds) {
    res.writeHead(302, { Location: `${origin}/login?error=oauth_not_configured` });
    res.end();
    return;
  }

  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  const redirectUri = `${proto === "https" ? "https" : "http"}://${hostHeader}/api/auth/google/callback`;

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseAnon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnon) {
    res.writeHead(302, { Location: `${origin}/login?error=server_config` });
    res.end();
    return;
  }

  const secure = isSecureCookieContext(req);
  const maxAgeSec = remember ? AUTH_COOKIE_MAX_AGE_SEC : undefined;

  const isMockOAuthCode = code === "e2e-oauth-success";
  if (isMockOAuthCode && process.env.NODE_ENV === "production") {
    throw new Error("Test-only OAuth mock path attempted in production");
  }

  if (
    isMockOAuthCode &&
    !(
      process.env.NODE_ENV === "test" &&
      isExplicitTestAuthEnabled() &&
      process.env.OAUTH_E2E_MOCK === "1"
    )
  ) {
    res.writeHead(302, { Location: `${origin}/login?error=oauth_mock_forbidden` });
    res.end();
    return;
  }

  // Test-only OAuth success path used by CI E2E (no external Google dependency).
  if (
    isMockOAuthCode &&
    process.env.NODE_ENV === "test" &&
    isExplicitTestAuthEnabled() &&
    process.env.OAUTH_E2E_MOCK === "1"
  ) {
    const jwtSecret = process.env.SUPABASE_JWT_SECRET?.trim();
    if (!jwtSecret) {
      res.writeHead(302, { Location: `${origin}/login?error=oauth_mock_missing_secret` });
      res.end();
      return;
    }

    const accessToken = buildMockSupabaseAccessToken({
      secret: jwtSecret,
      email: "oauth-e2e@techivano.test",
      sub: `oauth-e2e-${Date.now()}`,
      issuer: process.env.SUPABASE_JWT_ISSUER || undefined,
      audience: process.env.SUPABASE_JWT_AUDIENCE || undefined,
    });

    const refreshToken = `oauth-e2e-refresh-${Date.now()}`;
    const cookies: string[] = [
      buildHttpOnlyCookie(COOKIE_NAME, accessToken, { maxAgeSec, secure }),
      buildHttpOnlyCookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, { maxAgeSec, secure }),
    ];

    res.writeHead(302, {
      Location: `${origin}/`,
      "Set-Cookie": cookies,
    });
    res.end();
    return;
  }

  try {
    const idToken = await exchangeCodeForIdToken(
      code,
      redirectUri,
      creds.clientId,
      creds.clientSecret
    );

    const supabase = createClient(supabaseUrl, supabaseAnon);
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: idToken,
    });

    if (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[google-oauth] Supabase signInWithIdToken failed");
      }
      res.writeHead(302, {
        Location: `${origin}/login?error=oauth_signin_failed`,
      });
      res.end();
      return;
    }

    if (!data.session?.access_token) {
      res.writeHead(302, { Location: `${origin}/login?error=no_session` });
      res.end();
      return;
    }

    const cookies: string[] = [
      buildHttpOnlyCookie(COOKIE_NAME, data.session.access_token, { maxAgeSec, secure }),
    ];
    if (data.session.refresh_token) {
      cookies.push(
        buildHttpOnlyCookie(REFRESH_TOKEN_COOKIE_NAME, data.session.refresh_token, { maxAgeSec, secure })
      );
    }

    // Land on app root: cookies carry the Supabase session.
    const destination = `${origin}/`;

    res.writeHead(302, {
      Location: destination,
      "Set-Cookie": cookies,
    });
    res.end();
  } catch {
    console.error("[google-oauth] callback failed");
    res.writeHead(302, {
      Location: `${origin}/login?error=oauth_failed`,
    });
    res.end();
  }
}
