/**
 * Custom Google OAuth start — redirects to Google with a single OAuth client
 * so Google shows "continue to EAM" instead of the Supabase project URL.
 * Set GOOGLE_OAUTH_CLIENT_ID (and GOOGLE_OAUTH_CLIENT_SECRET in callback) and Application name "EAM" in Google Cloud.
 * @see docs/GOOGLE_OAUTH_CLIENT_NAME.md
 */
import type { IncomingMessage, ServerResponse } from "http";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPE = "openid email profile";

/** Host header value (hostname:port) for building redirect_uri — port must be preserved for Google to match. */
function getHostHeader(req: IncomingMessage): string {
  const raw =
    (req.headers["x-forwarded-host"] as string) ||
    (Array.isArray(req.headers.host) ? req.headers.host[0] : req.headers.host) ||
    "";
  return raw.trim();
}

function getClientId(): string | null {
  return process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() || null;
}

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.statusCode = 405;
    res.end();
    return;
  }

  const hostHeader = getHostHeader(req);
  const clientId = getClientId();
  if (!clientId) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "text/plain");
    res.end("Custom Google OAuth is not configured for this host.");
    return;
  }

  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  const origin = `${proto === "https" ? "https" : "http"}://${hostHeader}`;
  const redirectUri = `${origin}/api/auth/google/callback`;

  const url = new URL(req.url ?? "/", origin);
  const remember = url.searchParams.get("remember") === "1" ? "1" : "0";
  const state = Buffer.from(JSON.stringify({ remember, origin }), "utf8").toString("base64url");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    state,
    access_type: "offline",
    prompt: "select_account",
  });

  res.statusCode = 302;
  res.setHeader("Location", `${GOOGLE_AUTH_URL}?${params.toString()}`);
  res.end();
}
