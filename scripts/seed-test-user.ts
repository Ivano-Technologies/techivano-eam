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

async function run() {
  if (!supabaseUrl || !serviceRoleKey || !email || !password) {
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
