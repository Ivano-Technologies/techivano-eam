function requireEnv(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`)
  }
  return value
}

export const env = {
  SUPABASE_URL: requireEnv(
    "SUPABASE_URL",
    import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL
  ),

  SUPABASE_ANON_KEY: requireEnv(
    "SUPABASE_ANON_KEY",
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
      import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ),
}
