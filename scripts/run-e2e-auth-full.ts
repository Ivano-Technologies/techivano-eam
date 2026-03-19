/**
 * E2E pipeline: seed test user + org → run Playwright.
 * Session injection is handled by Playwright's globalSetup (tests/global.setup.ts)
 * which calls POST /api/dev-login and writes storageState.
 */
import { execSync, spawnSync } from "node:child_process";

function run(cmd: string, args: string[], env: Record<string, string> = {}): boolean {
  const r = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...env },
  });
  return r.status === 0;
}

async function main() {
  console.log("[e2e] Seeding test user...");
  if (!run("pnpm", ["tsx", "scripts/seed-test-user.ts"])) {
    console.error("[e2e] seed-test-user failed");
    process.exit(1);
  }

  console.log("[e2e] Seeding org data...");
  try {
    execSync("pnpm exec tsx scripts/seed-org-data.ts", {
      encoding: "utf8",
      stdio: "inherit",
      env: { ...process.env, CI: "1", E2E_USER_ROLE: "viewer" },
    });
  } catch {
    console.error("[e2e] seed-org-data failed (non-fatal, continuing)");
  }

  // Auth E2E only: dev-login + session injection. RBAC specs use UI login (Clerk); run separately when Clerk E2E user is seeded.
  console.log("[e2e] Running Playwright (auth only)...");
  const specs = ["tests/e2e/auth.spec.ts"];
  const playwright = spawnSync("pnpm", ["exec", "playwright", "test", ...specs], {
    stdio: "inherit",
    shell: true,
    env: { ...process.env },
  });

  process.exit(playwright.status ?? 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
