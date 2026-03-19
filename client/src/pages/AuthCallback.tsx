/**
 * Clerk OAuth/email-link callback.
 * Clerk completes the auth redirect; then we sync an app session cookie via auth.setSession.
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AuthenticateWithRedirectCallback, useAuth } from "@clerk/clerk-react";
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
  const rememberMe = true;
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const branding = useAuthBranding();
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const setSession = trpc.auth.setSession.useMutation();

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!isLoaded) return;
      if (!isSignedIn) return;

      try {
        const token = await getToken();
        if (!token) {
          setError("No session token returned by Clerk.");
          return;
        }
        const result = await setSession.mutateAsync({ accessToken: token, rememberMe });
        if (cancelled) return;
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

    void run();
  }, [getToken, isLoaded, isSignedIn, setLocation, setSession]);

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
      <AuthenticateWithRedirectCallback signInFallbackRedirectUrl="/login" />
    </AuthPageLayout>
  );
}
