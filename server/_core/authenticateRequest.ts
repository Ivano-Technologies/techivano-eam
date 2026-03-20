/**
 * Central auth helper: read app_session_id (or Bearer), verify Supabase JWT, resolve user.
 * Supabase Auth is the only supported auth provider.
 * Never trust frontend-reported auth method — see docs/FINAL_AUTH_POLICY.md.
 * @see docs/SUPABASE_AUTH_MIGRATION_PLAN.md
 */
import { parse as parseCookie } from "cookie";
import type { IncomingMessage } from "http";
import type { User } from "../../drizzle/schema";
import { COOKIE_NAME, DEV_BYPASS_COOKIE_NAME } from "@shared/const";
import { getUserFromSupabaseToken, looksLikeSupabaseJwt } from "./supabaseAuth";
import { logger } from "./logger";

type RequestLike = IncomingMessage & { headers: Record<string, string | string[] | undefined> };

export function getSessionToken(req: RequestLike): string | undefined {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim() || undefined;
  }
  const cookieHeader = req.headers.cookie;
  if (typeof cookieHeader === "string") {
    const cookies = parseCookie(cookieHeader);
    return cookies[COOKIE_NAME];
  }
  return undefined;
}

type AuthMethod = "supabase" | "none";

function logAuthMetrics(method: AuthMethod, user: User | null, latencyMs: number): void {
  const meta: Record<string, unknown> = {
    auth_method: method,
    latency_ms: Math.round(latencyMs),
  };
  if (user) {
    const u = user as User & { id?: number; supabaseUserId?: string | null };
    meta.user = u.supabaseUserId ?? u.id ?? "unknown";
  }
  logger.info("auth request", meta);
}

/**
 * Authenticate request using Supabase JWT only (app_session_id or Authorization Bearer).
 * Returns User or null. No legacy auth; Supabase is the sole provider.
 * In development, supports dev bypass cookie (app_dev_bypass) for admin dashboard access.
 */
export async function authenticateRequest(req: RequestLike): Promise<User | null> {
  const start = performance.now();
  // Emergency mode only: set AUTH_BYPASS=1 to treat every request as the dev-admin user (never in production).
  const authBypassEnabled = process.env.AUTH_BYPASS === "1";
  if (authBypassEnabled) {
    try {
      const { getDevAdminUser } = await import("../db");
      const user = await getDevAdminUser(process.env.DEV_ADMIN_EMAIL ?? null);
      if (user) {
        logAuthMetrics("none", user as User, performance.now() - start);
        return user as User;
      }
    } catch {
      // Fall through to normal auth flow if bypass lookup fails.
    }
  }

  if (process.env.NODE_ENV === "development") {
    const cookieHeader = req.headers.cookie;
    if (typeof cookieHeader === "string") {
      const cookies = parseCookie(cookieHeader);
      const devByPassId = cookies[DEV_BYPASS_COOKIE_NAME];
      if (devByPassId) {
        const userId = parseInt(devByPassId, 10);
        if (Number.isInteger(userId) && userId > 0) {
          const { getUserByIdRoot } = await import("../db");
          const user = await getUserByIdRoot(userId);
          if (user) {
            logAuthMetrics("none", user as User, performance.now() - start);
            return user as User;
          }
        }
      }
    }
  }

  const token = getSessionToken(req);
  try {
    const hasToken = Boolean(token?.length);
    const likeSupabase = hasToken && looksLikeSupabaseJwt(token);
    if (token && likeSupabase) {
      const user = await getUserFromSupabaseToken(token);
      if (user) {
        logAuthMetrics("supabase", user as User, performance.now() - start);
        return user as User;
      }
    }
    logAuthMetrics("none", null, performance.now() - start);
    return null;
  } catch (err) {
    logAuthMetrics("none", null, performance.now() - start);
    return null;
  }
}
