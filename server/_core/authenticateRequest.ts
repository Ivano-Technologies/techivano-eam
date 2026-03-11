/**
 * Central auth helper: read app_session_id (or Bearer), verify Supabase JWT, resolve user.
 * Supabase Auth is the only supported auth provider; legacy Manus/app JWT is disabled.
 * @see docs/SUPABASE_AUTH_MIGRATION_PLAN.md
 */
import { parse as parseCookie } from "cookie";
import type { Request } from "express";
import type { User } from "../../drizzle/schema";
import { COOKIE_NAME } from "@shared/const";
import { getUserFromSupabaseToken, looksLikeSupabaseJwt } from "./supabaseAuth";
import { logger } from "./logger";

export function getSessionToken(req: Request): string | undefined {
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
 */
export async function authenticateRequest(req: Request): Promise<User | null> {
  const start = performance.now();
  const token = getSessionToken(req);

  try {
    if (token && looksLikeSupabaseJwt(token)) {
      const user = await getUserFromSupabaseToken(token);
      if (user) {
        logAuthMetrics("supabase", user as User, performance.now() - start);
        return user as User;
      }
    }
    logAuthMetrics("none", null, performance.now() - start);
    return null;
  } catch {
    logAuthMetrics("none", null, performance.now() - start);
    return null;
  }
}
