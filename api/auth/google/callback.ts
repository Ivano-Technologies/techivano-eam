/**
 * Custom Google OAuth callback — exchanges code for Google id_token,
 * then creates a Supabase session via signInWithIdToken and redirects to app /auth/callback.
 * Uses single GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET so Google shows "continue to EAM".
 * @see docs/GOOGLE_OAUTH_CLIENT_NAME.md
 */
import type { IncomingMessage, ServerResponse } from "http";
import { createClient } from "@supabase/supabase-js";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

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
    const text = await res.text();
    throw new Error(`Google token exchange failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { id_token?: string };
  if (!data.id_token) throw new Error("Google response missing id_token");
  return data.id_token;
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
  const remember = parsedState.remember === "1" ? "1" : "0";
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
      res.writeHead(302, {
        Location: `/login?error=${encodeURIComponent(error.message)}`,
      });
      res.end();
      return;
    }

    if (!data.session?.access_token) {
      res.writeHead(302, { Location: `${origin}/login?error=no_session` });
      res.end();
      return;
    }

    const callbackUrl = new URL("/auth/callback", origin);
    callbackUrl.searchParams.set("access_token", data.session.access_token);
    if (data.session.refresh_token) {
      callbackUrl.searchParams.set("refresh_token", data.session.refresh_token);
    }
    callbackUrl.searchParams.set("remember", remember);

    res.writeHead(302, { Location: callbackUrl.toString() });
    res.end();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.writeHead(302, {
      Location: `${origin}/login?error=${encodeURIComponent(message)}`,
    });
    res.end();
  }
}
