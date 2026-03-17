/**
 * Generates a valid session (access_token) for the E2E test user.
 * Use for OAuth bypass: inject this token as app_session_id cookie in Playwright
 * instead of automating Google login. Outputs JSON to stdout for CI (e.g. TEST_SESSION).
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or anon key, E2E_AUTH_EMAIL, E2E_AUTH_PASSWORD
 * Uses anon key (VITE_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY); service role cannot sign in as user.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const email = process.env.E2E_AUTH_EMAIL!;
const password = process.env.E2E_AUTH_PASSWORD!;

async function run() {
  if (!email || !password) {
    console.error("Missing E2E_AUTH_EMAIL or E2E_AUTH_PASSWORD");
    process.exit(1);
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error(error);
    process.exit(1);
  }

  if (!data.session?.access_token) {
    console.error("No session or access_token");
    process.exit(1);
  }

  console.log(
    JSON.stringify({
      access_token: data.session.access_token,
    })
  );
}

run();
