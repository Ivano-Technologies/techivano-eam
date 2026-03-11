/**
 * Request-level identity cache: cache resolved User by Supabase sub (auth.users.id).
 * Reduces DB load when the same user makes many API calls (e.g. dashboards with 10–40 endpoints).
 * @see docs/SUPABASE_AUTH_MIGRATION_PLAN.md
 */
import * as db from "../db";
import { getRedis } from "./redis";
import type { User } from "../../drizzle/schema";

const KEY_PREFIX = "user:";
const CACHE_TTL_SECONDS = 3600; // 1 hour; aligns with typical Supabase token lifetime

function cacheKey(sub: string): string {
  return `${KEY_PREFIX}${sub}`;
}

/**
 * Get user by Supabase sub: Redis first, then DB. Caches on DB hit.
 */
export async function getCachedUser(sub: string): Promise<User | null> {
  const client = getRedis();
  if (client) {
    try {
      const cached = await client.get(cacheKey(sub));
      if (cached) {
        const parsed = JSON.parse(cached) as User;
        return parsed;
      }
    } catch {
      // Fall through to DB on Redis errors
    }
  }

  const user = await db.getUserBySupabaseUserId(sub);
  if (!user) return null;

  const toCache = user as User;
  if (client) {
    try {
      await client.set(
        cacheKey(sub),
        JSON.stringify(toCache),
        "EX",
        CACHE_TTL_SECONDS
      );
    } catch {
      // Non-fatal: continue without caching
    }
  }
  return toCache;
}

/**
 * Store user in cache (e.g. after lazy migration by email).
 * Call with the Supabase sub and the full user object to cache.
 */
export async function setUserInCache(sub: string, user: User): Promise<void> {
  const client = getRedis();
  if (!client) return;
  try {
    await client.set(
      cacheKey(sub),
      JSON.stringify(user),
      "EX",
      CACHE_TTL_SECONDS
    );
  } catch {
    // Non-fatal
  }
}

/**
 * Invalidate cached user when profile, role, or status is updated.
 * Call after updateUser / updateUserRole (and similar) so the next request gets fresh data.
 */
export async function invalidateUserCache(supabaseUserId: string | null | undefined): Promise<void> {
  if (!supabaseUserId) return;
  const client = getRedis();
  if (!client) return;
  try {
    await client.del(cacheKey(supabaseUserId));
  } catch {
    // Non-fatal
  }
}
