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

/** Session cookie options for persistent auth (Supabase access token). */
const AUTH_PERSISTENT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000; // 1 year

/**
 * Session cookie flags. In production, secure must be true or browsers may reject the cookie.
 * Values: httpOnly true, path "/", sameSite "lax", secure true in production or when x-forwarded-proto is https.
 * We do not set domain so the cookie is host-scoped (admin.techivano.com and nrcseam.techivano.com do not share sessions).
 */
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

/**
 * Options for setting the auth session cookie.
 * - rememberMe=true: persistent cookie (maxAge set)
 * - rememberMe=false: session cookie (expires on browser close)
 */
export function getAuthSessionCookieOptions(
  req: Request,
  opts?: { rememberMe?: boolean }
): Pick<CookieOptions, "httpOnly" | "path" | "sameSite" | "secure" | "maxAge"> {
  const rememberMe = opts?.rememberMe ?? true;
  if (!rememberMe) {
    return {
      ...getSessionCookieOptions(req),
    };
  }
  return {
    ...getSessionCookieOptions(req),
    maxAge: AUTH_PERSISTENT_MAX_AGE_MS, // Express expects milliseconds
  };
}
