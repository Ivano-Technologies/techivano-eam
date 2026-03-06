function numberFromEnv(name: string, fallback: number) {
  const raw = process.env[name];
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  redisUrl: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
  queueWorkerConcurrency: numberFromEnv("QUEUE_WORKER_CONCURRENCY", 4),
  queueDefaultAttempts: numberFromEnv("QUEUE_DEFAULT_ATTEMPTS", 5),
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
