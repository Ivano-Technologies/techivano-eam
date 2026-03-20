/**
 * Sprint 4.5 — structure checks:
 * - No resurrected monolithic server/db/platform.ts
 * - server/db domain files stay under a line budget (excludes tiny barrels)
 * - Only allowlisted sub-routers may use `import * as db from "../db"` (namespace import from barrel)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const DB_DIR = path.join(ROOT, "server", "db");
const ROUTERS_DIR = path.join(ROOT, "server", "routers");

const DB_MAX_LINES = 1000;
const DB_SKIP = new Set(["tables.ts", "index.ts"]);

/** Sub-routers allowed to import the whole DB barrel as `db` (prefer domain modules otherwise). */
const ROUTER_DB_NAMESPACE_ALLOWLIST = new Set([
  "adminImpersonation.ts",
  "assetCategories.ts",
  "auth.ts",
  "dashboard.ts",
  "inventory.ts",
  "nrcs.ts",
  "sessions.ts",
  "sites.ts",
]);

const NAMESPACE_DB_IMPORT = /import\s+\*\s+as\s+db\s+from\s+["']\.\.\/db["']/;

function countLines(filePath: string): number {
  const raw = fs.readFileSync(filePath, "utf8");
  return raw.split(/\r?\n/).length;
}

function fail(msg: string): never {
  console.error(`[check:architecture] ${msg}`);
  process.exit(1);
}

function main() {
  const platformPath = path.join(DB_DIR, "platform.ts");
  if (fs.existsSync(platformPath)) {
    fail(`Forbidden file exists: server/db/platform.ts (split into finance, compliance, audit, documents, etc.)`);
  }

  for (const name of fs.readdirSync(DB_DIR)) {
    if (!name.endsWith(".ts") || DB_SKIP.has(name)) continue;
    const p = path.join(DB_DIR, name);
    const lines = countLines(p);
    if (lines > DB_MAX_LINES) {
      fail(`server/db/${name} exceeds ${DB_MAX_LINES} lines (${lines}). Split or raise the budget intentionally.`);
    }
  }

  if (!fs.existsSync(ROUTERS_DIR)) fail(`Missing ${ROUTERS_DIR}`);

  for (const name of fs.readdirSync(ROUTERS_DIR)) {
    if (!name.endsWith(".ts")) continue;
    const p = path.join(ROUTERS_DIR, name);
    const src = fs.readFileSync(p, "utf8");
    if (!NAMESPACE_DB_IMPORT.test(src)) continue;
    if (!ROUTER_DB_NAMESPACE_ALLOWLIST.has(name)) {
      fail(
        `Disallowed pattern in server/routers/${name}: import * as db from "../db". ` +
          `Use a domain module (e.g. ../db/assets) or add to ROUTER_DB_NAMESPACE_ALLOWLIST in scripts/check-architecture.ts with justification.`
      );
    }
  }

  console.log("[check:architecture] OK");
}

main();
