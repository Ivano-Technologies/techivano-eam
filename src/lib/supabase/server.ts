/**
 * Server-side Supabase helpers for Next.js API routes.
 * Uses the same session token (app_session_id cookie or Bearer) as Express/tRPC
 * so auth is unified with server/_core/authenticateRequest.ts.
 * @see docs/SUPABASE_AUTH_MIGRATION_PLAN.md Phase 7
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { COOKIE_NAME } from "../../../shared/const";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * Read session token from NextRequest: app_session_id cookie or Authorization Bearer.
 * Same token source as Express authenticateRequest (getSessionToken).
 */
export function getSessionTokenFromRequest(request: NextRequest): string | undefined {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }
  const token = request.cookies.get(COOKIE_NAME)?.value;
  return token?.trim() || undefined;
}

/**
 * Create a Supabase client that sends the request's session token (cookie or Bearer).
 * Use this so supabase.auth.getUser() and supabase.from() use the same session as Express/tRPC.
 */
export async function getSupabaseForRequest(request: NextRequest): Promise<SupabaseClient> {
  const token = getSessionTokenFromRequest(request);
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  });
}

/**
 * Create a Supabase client with service role (bypasses RLS). Use only for admin operations.
 */
export function createAdminClient(): SupabaseClient {
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createClient(SUPABASE_URL, serviceRoleKey);
}

/**
 * Create a Supabase client without request context (e.g. server components that pass cookie elsewhere).
 * Prefer getSupabaseForRequest(request) in API routes so the same token is used.
 */
export function createServerClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
