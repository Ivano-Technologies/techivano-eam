/**
 * Add subdomain redirect URLs to Supabase Auth via Management API.
 * Run: pnpm tsx scripts/supabase-add-redirect-urls.ts
 * (After: supabase login — token is read from ~/.supabase/access-token if SUPABASE_ACCESS_TOKEN not set)
 *
 * Optional env: SUPABASE_ACCESS_TOKEN (from https://supabase.com/dashboard/account/tokens)
 * Optional env: SUPABASE_PROJECT_REF or VITE_SUPABASE_URL (to derive ref)
 */
import "dotenv/config";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const PROJECT_REF =
  process.env.SUPABASE_PROJECT_REF ||
  process.env.VITE_SUPABASE_PROJECT_REF ||
  extractRefFromUrl(process.env.VITE_SUPABASE_URL);

function readSupabaseAccessToken(): string | undefined {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN;
  const home = process.env.USERPROFILE || process.env.HOME || "";
  const path = join(home, ".supabase", "access-token");
  if (existsSync(path)) {
    try {
      return readFileSync(path, "utf8").trim();
    } catch {
      return undefined;
    }
  }
  return undefined;
}

const TOKEN = readSupabaseAccessToken();

const NEW_REDIRECT_URLS = [
  "https://admin.techivano.com",
  "https://admin.techivano.com/",
  "https://admin.techivano.com/auth/callback",
  "https://nrcseam.techivano.com",
  "https://nrcseam.techivano.com/",
  "https://nrcseam.techivano.com/auth/callback",
];

function extractRefFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  const m = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  return m ? m[1] : null;
}

function parseAllowList(raw: string | undefined): Set<string> {
  if (!raw || typeof raw !== "string") return new Set();
  const set = new Set<string>();
  for (const line of raw.split(/[\n,]/)) {
    const u = line.trim();
    if (u) set.add(u);
  }
  return set;
}

function formatAllowList(set: Set<string>): string {
  return [...set].sort().join("\n");
}

async function main() {
  if (!TOKEN) {
    console.error("Set SUPABASE_ACCESS_TOKEN (from https://supabase.com/dashboard/account/tokens)");
    process.exit(1);
  }
  if (!PROJECT_REF) {
    console.error("Set SUPABASE_PROJECT_REF or VITE_SUPABASE_URL so we can derive project ref");
    process.exit(1);
  }

  const base = `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
  };

  // GET current auth config
  const getRes = await fetch(base, { headers });
  if (!getRes.ok) {
    console.error("GET auth config failed:", getRes.status, await getRes.text());
    process.exit(1);
  }
  const config = (await getRes.json()) as { uri_allow_list?: string };
  const current = parseAllowList(config.uri_allow_list);
  const before = current.size;
  for (const u of NEW_REDIRECT_URLS) current.add(u);
  if (current.size === before) {
    console.log("All redirect URLs already present. No change.");
    process.exit(0);
  }

  // PATCH with merged uri_allow_list
  const body = JSON.stringify({ uri_allow_list: formatAllowList(current) });
  const patchRes = await fetch(base, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json" },
    body,
  });
  if (!patchRes.ok) {
    console.error("PATCH auth config failed:", patchRes.status, await patchRes.text());
    process.exit(1);
  }
  console.log("Updated Supabase Auth redirect URLs. Added:", NEW_REDIRECT_URLS.join(", "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
