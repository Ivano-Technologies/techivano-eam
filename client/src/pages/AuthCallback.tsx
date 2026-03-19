/**
 * Supabase Auth callback — PKCE-only flow.
 * Supabase redirects here with ?code=... (magic link). We exchange code for session,
 * set app cookie via tRPC, then redirect. No hash or legacy paths.
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
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
      // Supabase can send errors/code in query (?...) or hash (#...) depending on flow
      const queryParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const get = (key: string) => queryParams.get(key) ?? hashParams.get(key);
      const code = get("code");
      const rememberMe = get("remember") !== "0";

      const errDesc = get("error_description") || get("error");
      const errCode = get("error_code");
      if (errDesc || get("error")) {
        const text = errDesc ? decodeURIComponent(errDesc.replace(/\+/g, " ")) : "Sign-in failed.";
        const friendly =
          errCode === "otp_expired"
            ? "This magic link has expired. Please request a new one."
            : text;
        if (!cancelled) {
          setError(friendly);
          window.history.replaceState(null, "", window.location.pathname);
        }
        return;
      }

      // Prefer PKCE code exchange; fallback to access_token in hash (implicit flow, e.g. link opened in different browser)
      let token: string | null = null;
      if (code) {
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (exchangeError) {
          setError(exchangeError.message);
          return;
        }
        token = data?.session?.access_token ?? null;
      } else {
        const accessTokenFromHash = hashParams.get("access_token");
        if (accessTokenFromHash) {
          token = accessTokenFromHash;
        }
      }

      if (!token) {
        if (!cancelled) {
          setError(
            "No sign-in code received. Open the link from your email in the same browser where you requested it, or request a new link."
          );
        }
        return;
      }

      try {
        const result = await setSession.mutateAsync({ accessToken: token, rememberMe });
        if (cancelled) return;
        window.history.replaceState(null, "", window.location.pathname);
        const r = result as { requiresPasswordSetup?: boolean; mandatoryForOwner?: boolean };
        if (r.requiresPasswordSetup) {
          const q = r.mandatoryForOwner ? "?from=oauth&mandatory=1" : "?from=oauth";
          setLocation(`/set-password${q}`);
        } else {
          setLocation("/");
        }
      } catch (e) {
        setError(messageFromError(e));
      }
    }

    run();
  }, [setLocation]);

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
