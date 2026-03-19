#!/usr/bin/env node
/**
 * Poll GitHub for PR #12 and Auth E2E run status. Run: node scripts/monitor-pr-and-deploy.mjs
 * When Auth E2E is green, merge the PR at https://github.com/Ivano-Technologies/techivano-eam/pull/12
 * Deploy runs on push to main (Techivano Auto Deploy workflow).
 */
const PR_NUMBER = 12;
const OWNER = "Ivano-Technologies";
const REPO = "techivano-eam";
const API = `https://api.github.com/repos/${OWNER}/${REPO}`;

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function main() {
  const pr = await fetchJson(`${API}/pulls/${PR_NUMBER}`);
  const sha = pr.head.sha;
  const status = await fetchJson(`${API}/commits/${sha}/status`);
  const runs = await fetchJson(`${API}/actions/runs?per_page=3&branch=staging`);

  console.log("PR #12:", pr.state, pr.merged_at ? "(merged)" : "");
  console.log("Head:", sha.slice(0, 7), pr.head.ref);
  console.log("Commit status:", status.state, status.statuses?.map((s) => `${s.context}: ${s.state}`).join(", ") || "");
  const authRun = runs.workflow_runs?.find((r) => r.name === "Auth E2E" && r.head_sha === sha);
  if (authRun) {
    console.log("Auth E2E run:", authRun.status, authRun.conclusion ?? "-", authRun.html_url);
  }
  if (status.state === "success" && !pr.merged_at) {
    console.log("\n→ CI is green. Merge the PR:", pr.html_url);
  }
  if (pr.merged_at) {
    console.log("\n→ PR merged at", pr.merged_at, "- deploy should be running or complete on Vercel.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
