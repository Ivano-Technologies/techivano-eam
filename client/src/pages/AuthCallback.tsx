/**
 * Supabase Auth callback — exchange code for session and set app cookie via tRPC.
 * Route: /auth/callback. Supabase redirects here with ?code=... (PKCE) or hash.
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const setSessionMutation = trpc.auth.setSession.useMutation();

  useEffect(() => {
    let cancelled = false;

    async function handleCallback() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const hashParams = new URLSearchParams(
        window.location.hash?.replace(/^#/, "") || ""
      );
      const accessToken = hashParams.get("access_token");

      if (code) {
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (exchangeError) {
          setError(exchangeError.message);
          return;
        }
        if (data?.session?.access_token) {
          try {
            await setSessionMutation.mutateAsync({
              accessToken: data.session.access_token,
            });
            if (!cancelled) setLocation("/");
            return;
          } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to set session");
            return;
          }
        }
      }

      if (accessToken) {
        try {
          await setSessionMutation.mutateAsync({ accessToken });
          if (!cancelled) setLocation("/");
          return;
        } catch (e) {
          setError(e instanceof Error ? e.message : "Failed to set session");
          return;
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.access_token) {
        try {
          await setSessionMutation.mutateAsync({
            accessToken: session.access_token,
          });
          if (!cancelled) setLocation("/");
          return;
        } catch (e) {
          setError(e instanceof Error ? e.message : "Failed to set session");
          return;
        }
      }

      setError("No session received. Please try signing in again.");
    }

    handleCallback();
    return () => {
      cancelled = true;
    };
  }, [setLocation]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <p className="text-destructive mb-4">{error}</p>
          <a href="/login" className="text-primary underline">
            Return to sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
