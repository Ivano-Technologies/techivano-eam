/**
 * Full auth E2E pipeline: seed user → seed org → generate session → run Playwright with TEST_SESSION and TEST_ORG_ID.
 * Use in CI so OAuth-equivalent and multi-tenant tests run without flaky Google automation.
 */
import { spawnSync } from "node:child_process";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function runAndCaptureLastLine(cmd: string, args: string[], env: Record<string, string> = {}): string | null {
  const r = spawnSync(cmd, args, {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  if (r.status !== 0 || !r.stdout) return null;
  const lines = r.stdout.trim().split("\n").filter(Boolean);
  return lines.length > 0 ? lines[lines.length - 1] : null;
}

/** Get the line that is JSON with an orgId string (ignores trailing driver warnings on stdout). */
function captureSeedOrgDataOutput(cmd: string, args: string[], env: Record<string, string> = {}): string | null {
  const r = spawnSync(cmd, args, {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  if (r.status !== 0 || !r.stdout) return null;
  const lines = r.stdout.trim().split("\n").filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    try {
      const parsed = JSON.parse(line) as { orgId?: unknown };
      if (parsed && isValidOrgId(parsed.orgId)) return line;
    } catch {
      /* not our JSON */
    }
  }
  return null;
}

async function main() {
  if (!run("pnpm", ["tsx", "scripts/seed-test-user.ts"])) {
    process.exit(1);
  }

  const orgLine = captureSeedOrgDataOutput("pnpm", ["tsx", "scripts/seed-org-data.ts"], {
    CI: "1",
    E2E_USER_ROLE: "viewer",
  });
  if (!orgLine) {
    console.error("seed-org-data did not output TEST_ORG_ID");
    process.exit(1);
  }
  let parsed: { orgId?: unknown };
  try {
    parsed = JSON.parse(orgLine) as { orgId?: unknown };
  } catch {
    console.error("seed-org-data output is not valid JSON with orgId");
    process.exit(1);
  }
  if (!parsed || !isValidOrgId(parsed.orgId)) {
    console.error("Invalid orgId format (expected UUID string)");
    process.exit(1);
  }
  const testOrgId = parsed.orgId;

  const sessionOutput = runAndCaptureLastLine("pnpm", ["tsx", "scripts/create-test-session.ts"]);
  if (!sessionOutput) {
    console.error("create-test-session did not output session JSON");
    process.exit(1);
  }

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
