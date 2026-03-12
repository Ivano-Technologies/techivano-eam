/**
 * Supabase Auth callback — exchange code for session and set app cookie via tRPC.
 * Route: /auth/callback. Supabase redirects here with ?code=... (PKCE) or hash.
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import { AuthPageLayout, AuthLogo, ManusStyleAuthFooter } from "@/components/AuthPageLayout";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

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
        fetch("http://127.0.0.1:7731/ingest/be035081-9291-42da-b573-2615178ac1de", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "cb0794" }, body: JSON.stringify({ sessionId: "cb0794", location: "AuthCallback.tsx", message: "callback has code", data: { hasCode: true }, timestamp: Date.now(), hypothesisId: "D" }) }).catch(() => {});
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        fetch("http://127.0.0.1:7731/ingest/be035081-9291-42da-b573-2615178ac1de", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "cb0794" }, body: JSON.stringify({ sessionId: "cb0794", location: "AuthCallback.tsx:exchange", message: "exchange result", data: { ok: !exchangeError && !!data?.session?.access_token, errorMsg: exchangeError?.message?.slice(0, 60) }, timestamp: Date.now(), hypothesisId: "D" }) }).catch(() => {});
        if (exchangeError) {
          setError(exchangeError.message);
          return;
        }
        if (data?.session?.access_token) {
          try {
            await setSessionMutation.mutateAsync({
              accessToken: data.session.access_token,
            });
            fetch("http://127.0.0.1:7731/ingest/be035081-9291-42da-b573-2615178ac1de", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "cb0794" }, body: JSON.stringify({ sessionId: "cb0794", location: "AuthCallback.tsx:setSession", message: "callback setSession ok", data: {}, timestamp: Date.now(), hypothesisId: "D" }) }).catch(() => {});
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
        variant="manusDark"
        icon={<AuthLogo />}
        title="Sign-in issue"
        description={error}
        footer={<ManusStyleAuthFooter />}
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
      icon={<AuthLogo />}
      title="Completing sign-in..."
      description="Please wait while we set up your session."
      footer={<ManusStyleAuthFooter />}
    >
      <div className="flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
      </div>
    </AuthPageLayout>
  );
}
