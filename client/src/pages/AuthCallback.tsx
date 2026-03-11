/**
 * Supabase Auth callback — exchange code for session and set app cookie via tRPC.
 * Route: /auth/callback. Supabase redirects here with ?code=... (PKCE) or hash.
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import { AuthPageLayout, AuthIconCircle } from "@/components/AuthPageLayout";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2 } from "lucide-react";

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
      <AuthPageLayout
        icon={<AuthIconCircle variant="error"><AlertCircle className="h-6 w-6" /></AuthIconCircle>}
        title="Sign-in issue"
        description={error}
      >
        <Button asChild className="w-full bg-[#DC2626] hover:bg-[#DC2626]/90 text-white">
          <a href="/login">Return to sign in</a>
        </Button>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout
      icon={
        <AuthIconCircle>
          <Loader2 className="h-6 w-6 animate-spin" />
        </AuthIconCircle>
      }
      title="Completing sign-in..."
      description="Please wait while we set up your session."
    >
      <div className="flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
      </div>
    </AuthPageLayout>
  );
}
