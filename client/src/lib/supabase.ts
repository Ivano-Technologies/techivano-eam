import { createClient, SupabaseClient } from "@supabase/supabase-js"
import { env } from "./env"

// Use placeholder when vars missing so the app (and login page) loads without throwing.
// Login guards with useSupabaseAuth (VITE_SUPABASE_URL) and will show an error on submit if not configured.
const url = env.SUPABASE_URL || "https://placeholder.supabase.co"
const key = env.SUPABASE_ANON_KEY || "placeholder-anon-key"

// PKCE flow is required so magic link and OAuth redirects include ?code=... for exchangeCodeForSession.
// Without flowType: 'pkce', Supabase may redirect without the code, causing "No sign-in code received".
export const supabase: SupabaseClient = createClient(url, key, {
  auth: {
    flowType: "pkce",
    detectSessionInUrl: false, // we handle the callback manually in AuthCallback
  },
})
