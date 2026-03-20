/**
 * Local diagnostics: print package resolution and env hints (no external telemetry).
 */
function resolvePkg(pkg) {
  try {
    return require.resolve(`${pkg}/package.json`, { paths: [process.cwd()] });
  } catch (error) {
    return `ERR:${error?.code || "UNKNOWN"}`;
  }
}

const context = {
  cwd: process.cwd(),
  node: process.version,
};

const packages = {
  vite: resolvePkg("vite"),
  postgres: resolvePkg("postgres"),
  trpcServer: resolvePkg("@trpc/server"),
  typescript: resolvePkg("typescript"),
};

const viteClientDts = resolvePkg("vite").replace("package.json", "client.d.ts");

const envFingerprint = {
  npmExecPath: process.env.npm_execpath || null,
  pathHead: (process.env.PATH || "").split(";").slice(0, 6),
};

console.log(JSON.stringify({ context, packages, viteClientDts, envFingerprint }, null, 2));
