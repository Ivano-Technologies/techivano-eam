/**
 * Full auth E2E pipeline: seed user → seed org → generate session → run Playwright with TEST_SESSION and TEST_ORG_ID.
 * Use in CI so OAuth-equivalent and multi-tenant tests run without flaky Google automation.
 */
import { execSync, spawnSync } from "node:child_process";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// #region agent log
const DEBUG_INGEST_URL = "http://127.0.0.1:7731/ingest/be035081-9291-42da-b573-2615178ac1de";

function debugLog(
  hypothesisId: string,
  message: string,
  data: Record<string, unknown>,
  runId = "pre-fix"
) {
  void fetch(DEBUG_INGEST_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "6cca32",
    },
    body: JSON.stringify({
      sessionId: "6cca32",
      runId,
      hypothesisId,
      location: "scripts/run-e2e-auth-full.ts",
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}
// #endregion agent log

function isValidOrgId(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

function run(cmd: string, args: string[], env: Record<string, string> = {}): boolean {
  const r = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...env },
  });
  return r.status === 0;
}

/** Extract orgId from seed-org-data output; scans all lines for JSON with orgId. */
function extractOrgId(output: string): string {
  const lines = output.trim().split("\n").filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    try {
      const parsed = JSON.parse(line) as { orgId?: unknown };
      if (parsed?.orgId && isValidOrgId(parsed.orgId)) return parsed.orgId as string;
    } catch {
      /* not our JSON */
    }
  }
  throw new Error("TEST_ORG_ID not found in output");
}

/** Extract session JSON string from create-test-session output; scans for JSON with access_token. */
function extractSession(output: string): string {
  const lines = output.trim().split("\n").filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    try {
      const parsed = JSON.parse(line) as { access_token?: unknown };
      if (parsed?.access_token && typeof parsed.access_token === "string") return line;
    } catch {
      /* not our JSON */
    }
  }
  throw new Error("session JSON not found in output");
}

async function main() {
  debugLog("H1", "entry env snapshot", {
    hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
    hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    hasAuthEmail: Boolean(process.env.E2E_AUTH_EMAIL),
    hasAuthPassword: Boolean(process.env.E2E_AUTH_PASSWORD),
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    e2eBaseUrl: process.env.E2E_BASE_URL ?? null,
  });

  if (!run("pnpm", ["tsx", "scripts/seed-test-user.ts"])) {
    process.exit(1);
  }
  debugLog("H2", "seed-test-user completed", {
    nextStep: "seed-org-data",
  });

  let seedOutput: string;
  try {
    seedOutput = execSync("pnpm exec tsx scripts/seed-org-data.ts", {
      encoding: "utf8",
      env: { ...process.env, CI: "1", E2E_USER_ROLE: "viewer" },
    });
  } catch (e) {
    const err = e as { status?: number; stderr?: string; stdout?: string };
    console.error("seed-org-data failed:", err.status ?? "unknown");
    if (err.stderr) console.error("stderr:", err.stderr.slice(0, 500));
    if (err.stdout) console.error("stdout:", err.stdout.slice(0, 500));
    process.exit(1);
  }
  let testOrgId: string;
  try {
    testOrgId = extractOrgId(seedOutput);
  } catch (e) {
    console.error("seed-org-data did not output TEST_ORG_ID:", (e as Error).message);
    console.error("output (first 600 chars):", JSON.stringify(seedOutput.slice(0, 600)));
    process.exit(1);
  }
  debugLog("H3", "seed-org-data completed and org parsed", {
    orgIdCaptured: Boolean(testOrgId),
    orgIdValid: isValidOrgId(testOrgId),
  });

  let sessionOutput: string;
  try {
    const out = execSync("pnpm exec tsx scripts/create-test-session.ts", {
      encoding: "utf8",
      env: { ...process.env },
    });
    sessionOutput = extractSession(out);
  } catch (e) {
    const err = e as { status?: number; stderr?: string; stdout?: string };
    console.error("create-test-session failed:", err.status ?? "unknown");
    if (err.stderr) console.error("stderr:", err.stderr.slice(0, 500));
    if (err.stdout) console.error("stdout:", err.stdout.slice(0, 500));
    process.exit(1);
  }
  debugLog("H4", "session created", {
    sessionOutputPresent: Boolean(sessionOutput),
    nextStep: "playwright",
  });

  const playwrightEnv = {
    ...process.env,
    TEST_SESSION: sessionOutput,
    TEST_ORG_ID: testOrgId,
  };

  const playwright = spawnSync("pnpm", [
    "exec",
    "playwright",
    "test",
    "tests/e2e/auth.spec.ts",
    "tests/e2e/rbac.spec.ts",
  ], {
    stdio: "inherit",
    shell: true,
    env: playwrightEnv,
  });

  if (playwright.status !== 0) {
    process.exit(playwright.status ?? 1);
  }

  if (process.env.RUN_RLS_TEST === "1") {
    const rls = spawnSync(
      "pnpm",
      ["tsx", "scripts/test-rls-enforcement.ts"],
      { stdio: "inherit", shell: true, env: { ...playwrightEnv, TEST_SESSION: sessionOutput } }
    );
    process.exit(rls.status ?? 0);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
