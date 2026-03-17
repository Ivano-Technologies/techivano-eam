/**
 * Supabase Auth callback — exchange code for session and set app cookie via tRPC.
 * Route: /auth/callback. Supabase redirects here with ?code=... (PKCE) or hash.
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import { AuthPageLayout, AuthLogo, ManusStyleAuthFooter } from "@/components/AuthPageLayout";
import { useAuthBranding } from "@/hooks/useAuthBranding";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function AuthCallback() {
  const branding = useAuthBranding();
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const setSessionMutation = trpc.auth.setSession.useMutation();

  useEffect(() => {
    let cancelled = false;

    async function handleCallback() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const rememberMe = params.get("remember") !== "0";
      const hashParams = new URLSearchParams(
        window.location.hash?.replace(/^#/, "") || ""
      );
      const accessTokenFromHash = hashParams.get("access_token");
      const accessTokenFromQuery = params.get("access_token");
      const accessToken = accessTokenFromQuery ?? accessTokenFromHash;

      if (accessTokenFromQuery) {
        try {
          const result = await setSessionMutation.mutateAsync({
            accessToken: accessTokenFromQuery,
            rememberMe,
          });
          if (!cancelled) {
            window.history.replaceState(null, "", window.location.pathname);
            const r = result as { requiresPasswordSetup?: boolean; mandatoryForOwner?: boolean };
            if (r.requiresPasswordSetup) {
              const q = r.mandatoryForOwner ? "?from=oauth&mandatory=1" : "?from=oauth";
              setLocation(`/set-password${q}`);
            } else {
              setLocation("/");
            }
          }
          return;
        } catch (e) {
          setError(e instanceof Error ? e.message : "Failed to set session");
          return;
        }
      }

      if (code) {
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (exchangeError) {
          setError(exchangeError.message);
          return;
        }
        if (data?.session?.access_token) {
          try {
            const result = await setSessionMutation.mutateAsync({
              accessToken: data.session.access_token,
              rememberMe,
            });
            if (!cancelled) {
              const r = result as { requiresPasswordSetup?: boolean; mandatoryForOwner?: boolean };
              if (r.requiresPasswordSetup) {
                const q = r.mandatoryForOwner ? "?from=oauth&mandatory=1" : "?from=oauth";
                setLocation(`/set-password${q}`);
              } else {
                setLocation("/");
              }
            }
            return;
          } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to set session");
            return;
          }
        }
      }

      if (accessTokenFromHash) {
        try {
          const result = await setSessionMutation.mutateAsync({
            accessToken: accessTokenFromHash,
            rememberMe,
          });
          if (!cancelled) {
            const r = result as { requiresPasswordSetup?: boolean; mandatoryForOwner?: boolean };
            if (r.requiresPasswordSetup) {
              const q = r.mandatoryForOwner ? "?from=oauth&mandatory=1" : "?from=oauth";
              setLocation(`/set-password${q}`);
            } else {
              setLocation("/");
            }
          }
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
          const result = await setSessionMutation.mutateAsync({
            accessToken: session.access_token,
            rememberMe,
          });
          if (!cancelled) {
            const r = result as { requiresPasswordSetup?: boolean; mandatoryForOwner?: boolean };
            if (r.requiresPasswordSetup) {
              const q = r.mandatoryForOwner ? "?from=oauth&mandatory=1" : "?from=oauth";
              setLocation(`/set-password${q}`);
            } else {
              setLocation("/");
            }
          }
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
        variant="manusDark"
        icon={<AuthLogo branding={branding} />}
        title=""
        description={error}
        footer={<ManusStyleAuthFooter branding={branding} />}
      >
        <Button asChild className="w-full bg-[#DC2626] hover:bg-[#DC2626]/90 text-white">
          <a href="/login">Return to sign in</a>
        </Button>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout
      variant="manusDark"
      icon={<AuthLogo branding={branding} />}
      title="Completing sign-in..."
      description="Please wait while we set up your session."
      footer={<ManusStyleAuthFooter branding={branding} />}
    >
      <div className="flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
      </div>
    </AuthPageLayout>
  );
}
