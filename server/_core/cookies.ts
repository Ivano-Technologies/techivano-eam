import type { IncomingMessage } from "http";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

type RequestLike = IncomingMessage & { protocol?: string };

function isSecureRequest(req: RequestLike): boolean {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : (forwardedProto as string).split(",");

  return protoList.some((proto: string) => proto.trim().toLowerCase() === "https");
}

/** Session cookie options for persistent auth (Supabase access token). */
const AUTH_PERSISTENT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000; // 1 year

/** Session cookie options compatible with Express res.cookie(). */
export type SessionCookieOptions = {
  httpOnly: boolean;
  path: string;
  sameSite: "lax" | "strict" | "none";
  secure: boolean;
};

/**
 * Session cookie flags (security baseline).
 * httpOnly: true, secure: true in prod, sameSite: "lax" to reduce CSRF.
 * We do not set domain so the cookie is host-scoped (admin.techivano.com and nrcseam.techivano.com do not share sessions).
 */
export function getSessionCookieOptions(req: RequestLike): SessionCookieOptions {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: isProduction || isSecureRequest(req),
  };
}

/** Auth session cookie options (persistent or session). */
export type AuthSessionCookieOptions = SessionCookieOptions & { maxAge?: number };

/**
 * Options for setting the auth session cookie.
 * - rememberMe=true: persistent cookie (maxAge set)
 * - rememberMe=false: session cookie (expires on browser close)
 */
export function getAuthSessionCookieOptions(
  req: RequestLike,
  opts?: { rememberMe?: boolean }
): AuthSessionCookieOptions {
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
