/**
 * Server-side session helpers. Use with createServerClient() or getSupabaseForRequest().
 * @see docs/SUPABASE_AUTH_MIGRATION_PLAN.md
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type ServerUser = { id: string; email?: string; [key: string]: unknown };

/**
 * Get the current user from the Supabase client (e.g. created with getSupabaseForRequest).
 * Throws if not authenticated so callers can redirect or return 401.
 */
export async function requireServerUser(supabase: SupabaseClient): Promise<ServerUser> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("Unauthorized");
  }
  return {
    id: user.id,
    email: user.email ?? undefined,
    ...user,
  };
}
