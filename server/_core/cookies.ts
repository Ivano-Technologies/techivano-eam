import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

/** Session cookie options for auth (Supabase access token). Protects against XSS and CSRF. */
const AUTH_SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "httpOnly" | "path" | "sameSite" | "secure"> {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: isProduction || isSecureRequest(req),
  };
}

/** Options for setting the auth session cookie (includes maxAge). Use when calling res.cookie(COOKIE_NAME, value, options). */
export function getAuthSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "httpOnly" | "path" | "sameSite" | "secure" | "maxAge"> {
  return {
    ...getSessionCookieOptions(req),
    maxAge: AUTH_SESSION_MAX_AGE_MS, // Express expects milliseconds
  };
}
