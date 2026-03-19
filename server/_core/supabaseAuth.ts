/**
 * Supabase Auth — server-side JWT verification and user resolution.
 * Uses request-level identity cache (Redis) to avoid repeated DB lookups per request.
 * @see docs/SUPABASE_AUTH_MIGRATION_PLAN.md
 *
 * JWT verification strategy (ordered):
 *   1. HS256 with SUPABASE_JWT_SECRET (legacy)
 *   2. JWKS from Supabase auth endpoint (new signing keys, typically RS256)
 * Optional: SUPABASE_JWT_ISSUER and SUPABASE_JWT_AUDIENCE for extra claim checks.
 */
import { jwtVerify, createRemoteJWKSet } from "jose";
import * as db from "../db";
import { ENV } from "./env";
import { getCachedUser, setUserInCache } from "./userCache";
import type { User } from "../../drizzle/schema";

export type SupabaseTokenPayload = {
  sub: string;
  email?: string;
};

let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS(): ReturnType<typeof createRemoteJWKSet> | null {
  if (_jwks) return _jwks;
  const supabaseUrl = ENV.supabaseUrl;
  if (!supabaseUrl) return null;
  _jwks = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));
  return _jwks;
}

function extractPayload(jwtPayload: Record<string, unknown>): SupabaseTokenPayload | null {
  const sub = jwtPayload.sub;
  if (typeof sub !== "string" || !sub) return null;
  const email = typeof jwtPayload.email === "string" ? jwtPayload.email : undefined;
  return { sub, email };
}

/**
 * Verify Supabase access token (JWT) and return payload or null.
 * Tries HS256 with legacy secret first, then JWKS (RS256) for projects that
 * migrated to Supabase's new JWT signing keys.
 */
export async function verifySupabaseToken(
  token: string | undefined | null
): Promise<SupabaseTokenPayload | null> {
  if (!token?.trim()) return null;

  const baseOptions: { clockTolerance: number; issuer?: string; audience?: string } = {
    clockTolerance: 10,
  };
  if (ENV.supabaseJwtIssuer) baseOptions.issuer = ENV.supabaseJwtIssuer;
  if (ENV.supabaseJwtAudience) baseOptions.audience = ENV.supabaseJwtAudience;

  if (ENV.supabaseJwtSecret) {
    try {
      const secret = new TextEncoder().encode(ENV.supabaseJwtSecret);
      const { payload } = await jwtVerify(token, secret, { ...baseOptions, algorithms: ["HS256"] });
      return extractPayload(payload as Record<string, unknown>);
    } catch {
      // HS256 failed — fall through to JWKS
    }
  }

  const jwks = getJWKS();
  if (jwks) {
    try {
      const { payload } = await jwtVerify(token, jwks, baseOptions);
      return extractPayload(payload as Record<string, unknown>);
    } catch {
      // JWKS verification also failed
    }
  }

  return null;
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

  // Valid Supabase JWT but no app user: provision one so first-time Supabase users (e.g. test account) can log in
  const provisioned = await db.provisionUserFromSupabase(payload);
  if (provisioned) {
    const user = provisioned as User;
    await setUserInCache(payload.sub, user);
    return user;
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
