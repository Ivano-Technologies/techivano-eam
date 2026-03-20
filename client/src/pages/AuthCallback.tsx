/**
 * Supabase OAuth / magic-link callback.
 * Exchanges PKCE code (or hash access token fallback) and syncs app session cookie via auth.setSession.
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { supabase } from "@/lib/supabase";
import { AuthPageLayout, AuthLogo, AuthFooter } from "@/components/AuthPageLayout";
import { useAuthBranding } from "@/hooks/useAuthBranding";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const FALLBACK_MSG = "We're having trouble signing you in. Please try again.";

function messageFromError(e: unknown): string {
  const msg = e instanceof Error ? e.message : "";
  if (/is not valid JSON|Unexpected token|A server e/i.test(msg)) return FALLBACK_MSG;
  return msg || FALLBACK_MSG;
}

export default function AuthCallback() {
  const branding = useAuthBranding();
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const setSession = trpc.auth.setSession.useMutation();

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const url = new URL(window.location.href);
        const queryError = url.searchParams.get("error");
        const hashParams = new URLSearchParams((window.location.hash || "").replace(/^#/, ""));
        const hashError = hashParams.get("error");
        const errorCode = hashParams.get("error_code") ?? url.searchParams.get("error_code");
        const errorDescription =
          hashParams.get("error_description") ??
          url.searchParams.get("error_description") ??
          undefined;

        if (queryError || hashError) {
          if (errorCode === "otp_expired") {
            setError("This sign-in link has expired. Please request a new magic link and try again.");
            return;
          }
          setError(errorDescription || "Sign-in was denied. Please try again.");
          return;
        }

        let accessToken: string | null = null;
        const code = url.searchParams.get("code");
        const remember = url.searchParams.get("remember") !== "0";

        if (code) {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
          accessToken = data.session?.access_token ?? null;
        } else {
          const hashAccessToken = hashParams.get("access_token");
          accessToken = hashAccessToken || null;
        }

        if (!accessToken) {
          throw new Error("No sign-in code received.");
        }

        const result = await setSession.mutateAsync({ accessToken, rememberMe: remember });
        if (cancelled) return;
        const r = result as { requiresPasswordSetup?: boolean; mandatoryForOwner?: boolean };
        if (r.requiresPasswordSetup) {
          const q = r.mandatoryForOwner ? "?from=oauth&mandatory=1" : "?from=oauth";
          setLocation(`/set-password${q}`);
          return;
        }

        setLocation("/");
      } catch (e) {
        setError(messageFromError(e));
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [setLocation, setSession]);

  if (error) {
    return (
      <AuthPageLayout
        variant="authDark"
        icon={<AuthLogo branding={branding} />}
        title=""
        description={error}
        footer={<AuthFooter branding={branding} />}
      >
        <Button asChild className="w-full bg-[#DC2626] hover:bg-[#DC2626]/90 text-white">
          <a href="/login">Return to sign in</a>
        </Button>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout
      variant="authDark"
      icon={<AuthLogo branding={branding} />}
      title="Completing sign-in..."
      description="Please wait."
      footer={<AuthFooter branding={branding} />}
    >
      <div className="flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
      </div>
    </AuthPageLayout>
  );
}
