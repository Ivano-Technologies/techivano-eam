import { useState, useEffect, type FormEvent } from "react";
import { Link } from "wouter";
import type { Provider } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ButtonLoader } from "@/components/ButtonLoader";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { env } from "@/lib/env";
import { trpc } from "@/lib/trpc";
import { supabase } from "@/lib/supabase";
import { AuthPageLayout, AuthLogo, AuthFooter } from "@/components/AuthPageLayout";
import { useAuthBranding } from "@/hooks/useAuthBranding";

type OAuthProvider = "google" | "azure";

const turnstileSiteKey = env.TURNSTILE_SITE_KEY?.trim() ?? "";

export default function Login() {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const branding = useAuthBranding();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [showDevAdminButton, setShowDevAdminButton] = useState(false);
  const [devAdminLoading, setDevAdminLoading] = useState(false);
  const verifyTurnstile = trpc.auth.verifyTurnstile.useMutation();
  const setSession = trpc.auth.setSession.useMutation();
  const migrateLegacyPasswordUser = trpc.auth.migrateLegacyPasswordUser.useMutation();

  // Dev-only: show "Open admin dashboard" when running on system hostname GM AMPD
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    fetch("/api/dev-hostname")
      .then((r) => r.json())
      .then((data: { hostname?: string }) => {
        const hostname = (data.hostname ?? "").trim();
        if (hostname.toUpperCase() === "GM AMPD") setShowDevAdminButton(true);
      })
      .catch(() => {});
  }, []);

  // If Supabase already has a session (e.g. returning from OAuth), sync app session cookie.
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSessionToken(data.session?.access_token ?? null);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionToken(session?.access_token ?? null);
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    async function sync() {
      if (!sessionToken) return;
      try {
        await setSession.mutateAsync({ accessToken: sessionToken, rememberMe: true });
        if (typeof window !== "undefined" && window.location.pathname !== "/") {
          window.location.href = "/";
        }
      } catch {
        // Ignore; the user can still retry from the form.
      }
    }
    void sync();
  }, [sessionToken, setSession]);

  // Show success message when redirected after registration.
  useEffect(() => {
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    if (params.get("registered") === "1") {
      setMessage({ type: "success", text: "Account created. Please sign in." });
      const url = new URL(window.location.href);
      url.searchParams.delete("registered");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, []);

  const ensureTurnstileVerified = async (): Promise<boolean> => {
    if (!turnstileSiteKey) return true;
    if (!turnstileToken) {
      setMessage({ type: "error", text: "Please complete the verification check." });
      return false;
    }
    try {
      await verifyTurnstile.mutateAsync({ token: turnstileToken });
      return true;
    } catch {
      setMessage({ type: "error", text: "Verification failed. Please try again." });
      return false;
    }
  };

  const handleOAuthSignIn = async (provider: OAuthProvider) => {
    setMessage(null);
    if (!(await ensureTurnstileVerified())) return;
    setOauthLoading(provider);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider as Provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Sign-in failed. Please try again.",
      });
      setOauthLoading(null);
    }
  };

  const handleSignInWithPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setMessage(null);
    if (!(await ensureTurnstileVerified())) return;
    setPasswordLoading(true);
    try {
      let authResult = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authResult.error?.message?.toLowerCase().includes("invalid login credentials")) {
        const migrated = await migrateLegacyPasswordUser.mutateAsync({
          email: email.trim(),
          password,
        });
        if (migrated.success) {
          authResult = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
        }
      }
      if (authResult.error) throw authResult.error;
      const token = authResult.data.session?.access_token;
      if (!token) {
        setMessage({ type: "error", text: "Sign-in succeeded but no session was returned." });
        return;
      }
      await setSession.mutateAsync({ accessToken: token, rememberMe: true });
      window.location.href = "/";
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Sign-in failed. Please try again.",
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  const sendMagicLink = async () => {
    if (!email.trim()) return;
    setMessage(null);
    if (!(await ensureTurnstileVerified())) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to send magic link. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDevAdminLogin = async () => {
    setDevAdminLoading(true);
    try {
      const res = await fetch("/api/dev-admin-login", { method: "POST", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "error", text: (data as { error?: string }).error ?? "Dev admin login failed." });
        return;
      }
      window.location.href = "/";
    } catch {
      setMessage({ type: "error", text: "Dev admin login failed." });
    } finally {
      setDevAdminLoading(false);
    }
  };

  const formColor = "#252525";
  const textMuted = "#9ca3af";
  const buttonBorder = "rgba(255,255,255,0.12)";

  const signInTitle =
    branding === "ivano" ? (
      <>
        Sign in to Techivano
        <br />
        Enterprise Asset Management
      </>
    ) : (
      <>
        Sign in to NRCS
        <br />
        Enterprise Asset Management System
      </>
    );

  return (
    <AuthPageLayout
      variant="authDark"
      icon={<AuthLogo branding={branding} />}
      title={signInTitle}
      footer={<AuthFooter branding={branding} />}
    >
      {message && (
        <Alert variant={message.type === "error" ? "destructive" : "default"} className="mb-4">
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {sent ? (
        <div className="space-y-4">
          <Alert>
            <AlertDescription>Check your email for the sign-in link. Click the link to sign in.</AlertDescription>
          </Alert>
          <button
            type="button"
            className="text-xs underline text-[#9ca3af] hover:text-[#DC2626] transition-colors"
            onClick={() => {
              setSent(false);
              setEmail("");
              setMessage(null);
            }}
          >
            Try another email
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="outline"
              className="w-full border-white/20 text-white hover:bg-white/10 hover:text-white"
              style={{ backgroundColor: formColor }}
              disabled={oauthLoading !== null || (!!turnstileSiteKey && !turnstileToken)}
              onClick={() => handleOAuthSignIn("google")}
            >
              {oauthLoading === "google" ? (
                <ButtonLoader className="mr-2 h-4 w-4" />
              ) : (
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              Google
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full border-white/20 text-white hover:bg-white/10 hover:text-white"
              style={{ backgroundColor: formColor }}
              disabled={oauthLoading !== null || (!!turnstileSiteKey && !turnstileToken)}
              onClick={() => handleOAuthSignIn("azure")}
            >
              {oauthLoading === "azure" ? (
                <ButtonLoader className="mr-2 h-4 w-4" />
              ) : (
                <svg className="mr-2 h-4 w-4" viewBox="0 0 23 23" aria-hidden>
                  <path fill="#f35325" d="M1 1h10v10H1z" />
                  <path fill="#81bc06" d="M12 1h10v10H12z" />
                  <path fill="#05a6f0" d="M1 12h10v10H1z" />
                  <path fill="#ffba08" d="M12 12h10v10H12z" />
                </svg>
              )}
              Microsoft
            </Button>
          </div>
          <p className="text-center text-xs" style={{ color: textMuted }}>
            or sign in with email
          </p>
          <form onSubmit={handleSignInWithPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white font-medium">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={passwordLoading || loading}
                required
                className="w-full border-white/20 text-white placeholder:text-gray-400 focus-visible:ring-white/30"
                style={{ backgroundColor: formColor }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white font-medium">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={passwordLoading || loading}
                className="w-full border-white/20 text-white placeholder:text-gray-400 focus-visible:ring-white/30"
                style={{ backgroundColor: formColor }}
              />
            </div>
            <Button
              type="submit"
              className="w-full text-white font-medium hover:opacity-90 text-xs"
              style={{ backgroundColor: formColor, borderColor: buttonBorder, borderWidth: 1 }}
              disabled={passwordLoading || loading || (!!turnstileSiteKey && !turnstileToken)}
            >
              {passwordLoading ? (
                <>
                  <ButtonLoader className="mr-2" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                className="bg-transparent border-0 p-0 cursor-pointer font-inherit text-inherit underline text-[#9ca3af] hover:text-[#DC2626] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => {
                  if (!loading && !passwordLoading) void sendMagicLink();
                }}
                disabled={loading || passwordLoading || !email.trim() || (!!turnstileSiteKey && !turnstileToken)}
              >
                Send magic link instead
              </button>
              <Link href="/forgot-password" className="underline text-[#9ca3af] hover:text-[#DC2626] transition-colors">
                Forgot password?
              </Link>
            </div>
            {turnstileSiteKey && (
              <TurnstileWidget
                siteKey={turnstileSiteKey}
                theme="dark"
                scale={0.7}
                onVerify={setTurnstileToken}
                onExpire={() => setTurnstileToken(null)}
              />
            )}
            <div className="text-center text-xs pt-2" style={{ color: textMuted }}>
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="font-medium underline text-[#9ca3af] hover:text-[#DC2626] transition-colors">
                Request Access
              </Link>
            </div>
          </form>
        </div>
      )}
      {showDevAdminButton && (
        <div className="mt-6 pt-4 border-t border-white/10">
          <p className="text-center text-xs mb-2" style={{ color: textMuted }}>
            Dev only (GM AMPD)
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
            disabled={devAdminLoading}
            onClick={handleDevAdminLogin}
          >
            {devAdminLoading ? <ButtonLoader className="mr-2 h-4 w-4" /> : null}
            Dev: Open admin dashboard (bypass auth)
          </Button>
        </div>
      )}
    </AuthPageLayout>
  );
}
