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

/** Comma-separated list of global owner emails (must retain password, elevated to owner). Default: techivano global owners. */
function globalOwnerEmails(): string[] {
  const raw = process.env.GLOBAL_OWNER_EMAILS;
  if (raw === undefined || raw === "") {
    return ["kezieokpala@gmail.com", "ivanonigeria@gmail.com", "kezie@ivanotechnologies.com"];
  }
  return raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

/** True if email is in GLOBAL_OWNER_EMAILS (case-insensitive). Used for password strength and owner elevation. */
export function isGlobalOwnerEmail(email: string | null | undefined): boolean {
  if (!email || typeof email !== "string") return false;
  const set = new Set(globalOwnerEmails());
  return set.has(email.trim().toLowerCase());
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
  /** Resend: primary email provider for techivano.com. Verify domain at https://resend.com/domains. */
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  /** SMTP (Phase 70): optional fallback when Resend/Forge are not configured. */
  smtpHost: process.env.SMTP_HOST ?? "",
  smtpPort: numberFromEnv("SMTP_PORT", 587),
  smtpUser: process.env.SMTP_USER ?? "",
  smtpPass: process.env.SMTP_PASS ?? "",
  /** From address. For Resend use a verified domain (e.g. noreply@techivano.com). */
  emailFrom: process.env.EMAIL_FROM ?? process.env.SMTP_USER ?? "noreply@techivano.com",
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

  /** Global owner emails (comma-separated). These accounts require password and 12+ char passwords; always elevated to owner. */
  globalOwnerEmails: globalOwnerEmails(),
};
