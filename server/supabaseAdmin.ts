/**
 * Supabase Admin (service role) client for server-only operations.
 * Used to create auth users for legacy password migration (users created via signupWithPassword
 * exist in our DB but not in Supabase Auth).
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL ??
  process.env.VITE_SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ??
  "";

let adminClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdminClient() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null;
  if (!adminClient) {
    adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return adminClient;
}

/**
 * Create a Supabase Auth user with email/password (e.g. for legacy migration).
 * Returns the new auth user id (uuid) or null on failure.
 */
export async function createAuthUserWithPassword(
  email: string,
  password: string
): Promise<string | null> {
  const client = getSupabaseAdminClient();
  if (!client) return null;
  const {
    data,
    error,
  } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) return null;
  const id = data?.user?.id;
  return typeof id === "string" ? id : null;
}

/**
 * Update a Supabase Auth user's password (e.g. after app password reset).
 * Returns true if update succeeded.
 */
export async function updateAuthUserPassword(
  supabaseUserId: string,
  newPassword: string
): Promise<boolean> {
  const client = getSupabaseAdminClient();
  if (!client) return false;
  const { error } = await client.auth.admin.updateUserById(supabaseUserId, {
    password: newPassword,
  });
  return !error;
}

/**
 * Check if the Supabase Auth user (by id) likely has no password set (OAuth-only).
 * Heuristic: exactly one identity and provider is not "email" (e.g. google, azure).
 * Used to prompt OAuth users to set a password for recovery/CI.
 */
export async function checkRequiresPasswordSetup(
  supabaseUserId: string
): Promise<{ requiresPasswordSetup: boolean; email?: string }> {
  const client = getSupabaseAdminClient();
  if (!client) return { requiresPasswordSetup: false };
  const { data, error } = await client.auth.admin.getUserById(supabaseUserId);
  if (error || !data?.user) return { requiresPasswordSetup: false };
  const user = data.user as { email?: string; identities?: Array<{ provider?: string }> };
  const identities = user.identities ?? [];
  const email = typeof user.email === "string" ? user.email : undefined;
  // Single OAuth provider (no email identity) => assume no password set
  const requiresPasswordSetup =
    identities.length === 1 &&
    identities[0]?.provider !== "email";
  return { requiresPasswordSetup: !!requiresPasswordSetup, email };
}
