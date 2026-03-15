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

/** Public app URL for password reset links, magic links, QR codes (no trailing slash). */
function appUrl(): string {
  const raw =
    process.env.VITE_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return raw.replace(/\/$/, "");
}

/** Comma-separated list of allowed email domains for signup (e.g. "nrcs.org.ng,redcross.org"). Empty = use default list. */
function allowedSignupDomains(): string[] {
  const raw = process.env.ALLOWED_SIGNUP_DOMAINS;
  if (raw === undefined || raw === "") {
    const domains = ["redcrossnigeria.org", "ifrc.org", "gmail.com", "icloud.com", "yahoo.com", "outlook.com", "hotmail.com"];
    if (process.env.NODE_ENV === "test") domains.push("example.com");
    return domains;
  }
  return raw.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);
}

export const ENV = {
  /** Base URL of the app (e.g. https://techivano.com). Used for reset links, magic links, QR. */
  appUrl: appUrl(),
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
  /** SMTP (Phase 70): optional fallback when Forge is not configured. */
  smtpHost: process.env.SMTP_HOST ?? "",
  smtpPort: numberFromEnv("SMTP_PORT", 587),
  smtpUser: process.env.SMTP_USER ?? "",
  smtpPass: process.env.SMTP_PASS ?? "",
  emailFrom: process.env.EMAIL_FROM ?? process.env.SMTP_USER ?? "noreply@nrcs.org.ng",
  /** Allowed email domains for signup (from ALLOWED_SIGNUP_DOMAINS or default). */
  allowedSignupDomains: allowedSignupDomains(),
  /** If true, skip email domain check for signup (admin override / open signup). */
  openSignup: booleanFromEnv("OPEN_SIGNUP", false),

  /** Host → org: UUID for admin.techivano.com (Ivano mothership). Use canonical form 00000000-0000-4000-8000-<12 hex digits> for tenantId derivation. */
  hostOrgAdmin: process.env.HOST_ORG_ADMIN?.trim() || "",
  /** Host → org: UUID for nrcseam.techivano.com (NRCS tenant). Use canonical form for tenantId derivation. */
  hostOrgNrcs: process.env.HOST_ORG_NRCS?.trim() || "",
  /** Per-tenant allowed signup domains: admin subdomain (comma-separated, e.g. ivanotechnologies.com). */
  allowedDomainsAdmin: (process.env.ALLOWED_DOMAINS_ADMIN ?? "ivanotechnologies.com").split(",").map((d) => d.trim().toLowerCase()).filter(Boolean),
  /** Per-tenant allowed signup domains: NRCS subdomain (comma-separated). Empty = use default list. */
  allowedDomainsNrcs: process.env.ALLOWED_DOMAINS_NRCS
    ? process.env.ALLOWED_DOMAINS_NRCS.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean)
    : ["redcrossnigeria.org", "ifrc.org", "gmail.com", "icloud.com", "yahoo.com", "outlook.com", "hotmail.com"],
};
