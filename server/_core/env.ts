function numberFromEnv(name: string, fallback: number) {
  const raw = process.env[name];
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function booleanFromEnv(name: string, fallback: boolean) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw === "1" || raw.toLowerCase() === "true";
}

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  supabaseJwtSecret: process.env.SUPABASE_JWT_SECRET ?? "",
  supabaseJwtIssuer: process.env.SUPABASE_JWT_ISSUER ?? "",
  supabaseJwtAudience: process.env.SUPABASE_JWT_AUDIENCE ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  redisUrl: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
  queueWorkerConcurrency: numberFromEnv("QUEUE_WORKER_CONCURRENCY", 4),
  queueDefaultAttempts: numberFromEnv("QUEUE_DEFAULT_ATTEMPTS", 5),
  phase3WorkersEnabled: booleanFromEnv("PHASE3_WORKERS_ENABLED", false),
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
