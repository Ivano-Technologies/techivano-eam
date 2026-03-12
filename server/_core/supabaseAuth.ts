/**
 * Supabase Auth — server-side JWT verification and user resolution.
 * Uses request-level identity cache (Redis) to avoid repeated DB lookups per request.
 * @see docs/SUPABASE_AUTH_MIGRATION_PLAN.md
 *
 * JWT verification: Supabase uses HS256. Set SUPABASE_JWT_SECRET from Dashboard → API → JWT Secret.
 * Optional: SUPABASE_JWT_ISSUER (e.g. https://<project-ref>.supabase.co/auth/v1) and
 * SUPABASE_JWT_AUDIENCE (e.g. "authenticated") — must match Dashboard → API → JWT Settings if set.
 */
import { jwtVerify } from "jose";
import * as db from "../db";
import { ENV } from "./env";
import { getCachedUser, setUserInCache } from "./userCache";
import type { User } from "../../drizzle/schema";

export type SupabaseTokenPayload = {
  sub: string;
  email?: string;
};

const alg = "HS256";

/**
 * Verify Supabase access token (JWT) and return payload or null.
 * Validates exp, nbf (jose default), algorithms: ["HS256"], and optional iss/aud when configured.
 */
export async function verifySupabaseToken(
  token: string | undefined | null
): Promise<SupabaseTokenPayload | null> {
  if (!token?.trim()) return null;
  if (!ENV.supabaseJwtSecret) return null;

  try {
    const secret = new TextEncoder().encode(ENV.supabaseJwtSecret);
    const options: Parameters<typeof jwtVerify>[2] = {
      algorithms: [alg],
      clockTolerance: 10,
    };
    if (ENV.supabaseJwtIssuer) options.issuer = ENV.supabaseJwtIssuer;
    if (ENV.supabaseJwtAudience) options.audience = ENV.supabaseJwtAudience;

    const { payload } = await jwtVerify(token, secret, options);
    const sub = payload.sub;
    if (typeof sub !== "string" || !sub) return null;
    const email = typeof payload.email === "string" ? payload.email : undefined;
    return { sub, email };
  } catch {
    return null;
  }
}

/**
 * Resolve app User from Supabase access token.
 * Uses Redis identity cache for lookups by sub; falls back to DB and caches result.
 * 1) Cache/DB by supabase_user_id (sub).
 * 2) If not found, try match by email and set supabase_user_id (lazy migration), then cache.
 */
export async function getUserFromSupabaseToken(
  token: string | undefined | null
): Promise<User | null> {
  const payload = await verifySupabaseToken(token);
  if (!payload?.sub) return null;

  const cached = await getCachedUser(payload.sub);
  if (cached) return cached as User;

  if (payload.email) {
    const byEmail = await db.getUserByEmail(payload.email);
    if (byEmail) {
      const id = (byEmail as User & { id: number }).id;
      await db.setUserSupabaseId(id, payload.sub);
      const updated = await db.getUserBySupabaseUserId(payload.sub);
      const user = (updated ?? byEmail) as User;
      await setUserInCache(payload.sub, user);
      return user;
    }
  }

  return null;
}

/**
 * Heuristic: treat token as Supabase JWT if it's a three-part JWT and decoding (without verify)
 * shows a payload with "sub" (UUID-like). Avoids verifying with wrong secret.
 */
export function looksLikeSupabaseJwt(token: string | undefined | null): boolean {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8")
    ) as Record<string, unknown>;
    return typeof payload.sub === "string" && payload.sub.length > 0;
  } catch {
    return false;
  }
}
