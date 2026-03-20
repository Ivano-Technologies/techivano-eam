import fs from "node:fs/promises";
import path from "node:path";

type Violation = { file: string; reason: string };

const rootDir = process.cwd();
const scanDirs = ["api", "server", "client/src", "scripts"];
const ignoreSegments = ["node_modules", "dist", ".git", "coverage", ".vercel", ".next", "tests", "website"];
const allowedExpressFiles = new Set<string>([
  // Test-only helper imports are allowed by policy.
  "tests/api/serverless-routes.test.ts",
  // Compliance script intentionally references banned providers in detection rules.
  "scripts/check-serverless-compliance.ts",
]);

const checks: Array<{ reason: string; regex: RegExp }> = [
  { reason: "Express import/usage is not allowed in runtime code", regex: /\bfrom\s+["']express["']|\brequire\(\s*["']express["']\s*\)|\bexpress\(/ },
  { reason: "app.listen indicates non-serverless runtime drift", regex: /\bapp\.listen\s*\(/ },
  { reason: "Legacy server bootstrap import detected", regex: /server\/_core\/index/ },
  {
    reason: "Auth provider drift detected: Supabase is the only allowed auth provider",
    regex: /@clerk\/|clerk-react|clerk\/backend|next-auth|auth0|firebase\/auth/i,
  },
];

async function collectFiles(dir: string, out: string[]): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    const rel = path.relative(rootDir, abs).replaceAll("\\", "/");
    if (ignoreSegments.some((seg) => rel.split("/").includes(seg))) continue;
    if (entry.isDirectory()) {
      await collectFiles(abs, out);
      continue;
    }
    if (!/\.(ts|tsx|js|mjs)$/.test(entry.name)) continue;
    out.push(abs);
  }
}

async function main(): Promise<void> {
  const files: string[] = [];
  for (const dir of scanDirs) {
    const abs = path.join(rootDir, dir);
    try {
      await collectFiles(abs, files);
    } catch {
      // Optional directory; ignore if missing.
    }
  }

  const violations: Violation[] = [];
  for (const file of files) {
    const rel = path.relative(rootDir, file).replaceAll("\\", "/");
    if (allowedExpressFiles.has(rel)) continue;
    const content = await fs.readFile(file, "utf8");
    for (const check of checks) {
      if (check.regex.test(content)) {
        violations.push({ file: rel, reason: check.reason });
      }
    }
  }

  if (violations.length > 0) {
    console.error("\n[serverless-compliance] violations found:");
    for (const violation of violations) {
      console.error(` - ${violation.file}: ${violation.reason}`);
    }
    process.exit(1);
  }

  console.log("[serverless-compliance] passed");
}

main().catch((error) => {
  console.error("[serverless-compliance] failed unexpectedly:", (error as Error).message);
  process.exit(1);
});
