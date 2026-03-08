const endpoint = "http://127.0.0.1:7618/ingest/1b6b0209-b246-4830-b1f1-8517aa393bd2";
const sessionId = "4621af";
const runId = "root-mismatch-check-2";

function log(hypothesisId, location, message, data) {
  // #region agent log
  return fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": sessionId,
    },
    body: JSON.stringify({
      sessionId,
      runId,
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
}

function resolvePkg(pkg) {
  try {
    return require.resolve(`${pkg}/package.json`, { paths: [process.cwd()] });
  } catch (error) {
    return `ERR:${error?.code || "UNKNOWN"}`;
  }
}

await Promise.all([
  log("H1", "scripts/debug-check-env.mjs:35", "Execution context", {
    cwd: process.cwd(),
    node: process.version,
  }),
  log("H2", "scripts/debug-check-env.mjs:40", "Critical package resolution", {
    vite: resolvePkg("vite"),
    postgres: resolvePkg("postgres"),
    trpcServer: resolvePkg("@trpc/server"),
    typescript: resolvePkg("typescript"),
  }),
  log("H3", "scripts/debug-check-env.mjs:47", "Type target probe", {
    viteClientDtsCandidate: resolvePkg("vite").replace("package.json", "client.d.ts"),
  }),
  log("H4", "scripts/debug-check-env.mjs:51", "Env path fingerprint", {
    npmExecPath: process.env.npm_execpath || null,
    pathHead: (process.env.PATH || "").split(";").slice(0, 6),
  }),
]);

