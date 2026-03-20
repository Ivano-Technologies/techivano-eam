// Client: do not throw on missing vars so the login page can open even when Supabase
// is not configured (e.g. local dev). Use empty string when missing.
function getEnv(name: string, value: string | undefined): string {
  return value ?? "";
}

export const env = {
  SUPABASE_URL: getEnv(
    "SUPABASE_URL",
    import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL
  ),

  SUPABASE_ANON_KEY: getEnv(
    "SUPABASE_ANON_KEY",
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
      import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ),

  /** Cloudflare Turnstile site key (public). When set, login/signup require verification. */
  TURNSTILE_SITE_KEY: getEnv("TURNSTILE_SITE_KEY", import.meta.env.VITE_TURNSTILE_SITE_KEY),
};
