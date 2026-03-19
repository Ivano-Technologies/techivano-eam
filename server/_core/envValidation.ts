/**
 * Production env validation: warn on missing critical variables.
 * Does not block startup; use for visibility in logs.
 */
export function validateProductionEnv(): void {
  if (process.env.NODE_ENV !== "production") return;

  const missing: string[] = [];
  const critical = [
    "DATABASE_URL",
    "SUPABASE_JWT_SECRET",
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
  ];
  for (const key of critical) {
    const v = process.env[key];
    if (v === undefined || (typeof v === "string" && !v.trim())) {
      missing.push(key);
    }
  }
  if (missing.length > 0) {
    console.warn(
      "[env] Production: missing or empty recommended variables:",
      missing.join(", ")
    );
  }
}
