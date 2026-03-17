/**
 * Deterministic test user for E2E auth. Creates or resets the user in Supabase Auth
 * so CI and local runs have a known email/password. Run before auth E2E in CI:
 *
 *   pnpm run test:e2e:auth:ci
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, E2E_AUTH_EMAIL, E2E_AUTH_PASSWORD
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.E2E_AUTH_EMAIL!;
const password = process.env.E2E_AUTH_PASSWORD!;

async function debugLog(hypothesisId: string, location: string, message: string, data: Record<string, unknown>) {
  // #region agent log
  await fetch("http://127.0.0.1:7731/ingest/be035081-9291-42da-b573-2615178ac1de", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "ec4c30" }, body: JSON.stringify({ sessionId: "ec4c30", runId: "pre-fix", hypothesisId, location, message, data, timestamp: Date.now() }) }).catch(() => {});
  // #endregion
}

async function run() {
  await debugLog("H4", "seed-test-user.ts:env-check", "seed-test-user env presence", {
    hasSupabaseUrl: !!supabaseUrl,
    hasServiceRoleKey: !!serviceRoleKey,
    hasAuthEmail: !!email,
    hasAuthPassword: !!password,
  });
  if (!supabaseUrl || !serviceRoleKey || !email || !password) {
    await debugLog("H4", "seed-test-user.ts:env-missing", "seed-test-user missing required env", {
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceRoleKey: !!serviceRoleKey,
      hasAuthEmail: !!email,
      hasAuthPassword: !!password,
    });
    console.error("Missing one or more required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, E2E_AUTH_EMAIL, E2E_AUTH_PASSWORD");
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data } = await supabase.auth.admin.listUsers();
  const existing = data.users.find((u) => u.email === email);

  if (existing) {
    await supabase.auth.admin.updateUserById(existing.id, { password });
    console.log("✓ Test user reset");
    return;
  }

  const { error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    console.error(error);
    process.exit(1);
  }

  console.log("✓ Test user created");
}

run();
