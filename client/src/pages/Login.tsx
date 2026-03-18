import { useState, type ComponentType, type FormEvent } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox, RedCheckIcon } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { ButtonLoader } from "@/components/ButtonLoader";
import { supabase } from "@/lib/supabase";
import { AuthPageLayout, AuthLogo, ManusStyleAuthFooter } from "@/components/AuthPageLayout";
import { useAuthBranding } from "@/hooks/useAuthBranding";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const useSupabaseAuth = typeof supabaseUrl === "string" && supabaseUrl.length > 0;

/** Google "G" logo — standard four-color mark */
function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

/** Microsoft four-square logo */
function MicrosoftLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path fill="#F25022" d="M1 1h10v10H1z" />
      <path fill="#00A4EF" d="M1 13h10v10H1z" />
      <path fill="#7FBA00" d="M13 1h10v10H13z" />
      <path fill="#FFB900" d="M13 13h10v10H13z" />
    </svg>
  );
}

const SOCIAL_PROVIDERS: { id: "google" | "azure"; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { id: "google", label: "Continue with Google", Icon: GoogleLogo },
  { id: "azure", label: "Continue with Microsoft", Icon: MicrosoftLogo },
];

export default function Login() {
  const branding = useAuthBranding();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "azure" | null>(null);
  const [showMagicLinkForm, setShowMagicLinkForm] = useState(false);
  const [magicLinkEmail, setMagicLinkEmail] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);

  const setSessionMutation = trpc.auth.setSession.useMutation();
  const migrateLegacyMutation = trpc.auth.migrateLegacyPasswordUser.useMutation();
  const { data: googleOAuthConfig } = trpc.system.googleOAuthStartUrl.useQuery(undefined, {
    staleTime: 60_000,
  });
  const passwordLoginMutation = trpc.auth.loginWithPassword.useMutation({
    onSuccess: () => {
      window.location.href = "/";
    },
    onError: (error: unknown) => {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Login failed",
      });
    },
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!email) {
      setMessage({ type: "error", text: "Please enter your email" });
      return;
    }
    if (!password) {
      setMessage({ type: "error", text: "Please enter your password" });
      return;
    }

    if (useSupabaseAuth) {
      setLoading(true);
      try {
        let { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error && /invalid login credentials|invalid_credentials/i.test(error.message)) {
          const migrated = await migrateLegacyMutation.mutateAsync({ email, password });
          if (migrated.success) {
            const retry = await supabase.auth.signInWithPassword({ email, password });
            data = retry.data;
            error = retry.error;
          }
        }
        if (error) {
          setMessage({ type: "error", text: error.message });
          return;
        }
        if (data?.session?.access_token) {
          await setSessionMutation.mutateAsync({
            accessToken: data.session.access_token,
            rememberMe,
          });
          window.location.href = "/";
        }
      } catch (err) {
        const raw = err instanceof Error ? err.message : "Login failed";
        const text = /not valid JSON|Unexpected token|SyntaxError/i.test(raw)
          ? "Unable to reach the server. Please check your connection and try again."
          : raw;
        setMessage({ type: "error", text });
      } finally {
        setLoading(false);
      }
      return;
    }

    passwordLoginMutation.mutate({ email, password });
  };

  const isPending =
    loading ||
    passwordLoginMutation.isPending ||
    setSessionMutation.isPending;

  const handleOAuthSignIn = async (provider: "google" | "azure") => {
    if (!useSupabaseAuth) return;
    setMessage(null);
    setOauthLoading(provider);

    if (provider === "google" && googleOAuthConfig?.url) {
      const url = new URL(googleOAuthConfig.url, window.location.origin);
      url.searchParams.set("remember", rememberMe ? "1" : "0");
      window.location.href = url.toString();
      return;
    }

    try {
      const redirectTo = new URL("/auth/callback", window.location.origin);
      redirectTo.searchParams.set("remember", rememberMe ? "1" : "0");
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectTo.toString(),
          ...(provider === "azure" ? { scopes: "email openid" } : {}),
        },
      });
      if (error) {
        setMessage({ type: "error", text: error.message });
        setOauthLoading(null);
        return;
      }
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      setMessage({ type: "error", text: "Sign-in could not be started. Please try again." });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Sign-in failed. Please try again.",
      });
    } finally {
      setOauthLoading(null);
    }
  };

  const handleSendMagicLink = async (e: FormEvent) => {
    e.preventDefault();
    if (!useSupabaseAuth || !magicLinkEmail.trim()) return;
    setMessage(null);
    setMagicLinkLoading(true);
    try {
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOtp({
        email: magicLinkEmail.trim(),
        options: { emailRedirectTo: redirectTo },
      });
      if (error) {
        setMessage({ type: "error", text: error.message });
        return;
      }
      setMagicLinkSent(true);
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to send magic link. Please try again.",
      });
    } finally {
      setMagicLinkLoading(false);
    }
  };

  const formColor = "#252525"; // match card; unified dark with page bg
  const textMuted = "#9ca3af";
  const buttonBorder = "rgba(255,255,255,0.12)"; // slightly light grey border on buttons

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
      variant="manusDark"
      icon={<AuthLogo branding={branding} />}
      title={signInTitle}
      footer={<ManusStyleAuthFooter branding={branding} />}
    >
      {/* Google and Microsoft OAuth — only enabled when Supabase is configured */}
      <div className="space-y-2 mb-6">
        {SOCIAL_PROVIDERS.map(({ id, label, Icon }) => {
          const isOauthPending = oauthLoading === id;
          return (
            <Button
              key={id}
              type="button"
              variant="outline"
              className="w-full text-white hover:opacity-90 font-medium flex items-center justify-center gap-3"
              style={{ backgroundColor: formColor, borderColor: buttonBorder, borderWidth: 1 }}
              disabled={!useSupabaseAuth || isPending || isOauthPending}
              onClick={() => handleOAuthSignIn(id)}
            >
              {isOauthPending ? (
                <>
                  <ButtonLoader className="mr-2" />
                  Redirecting...
                </>
              ) : (
                <>
                  <Icon className="h-5 w-5 shrink-0" />
                  {label}
                </>
              )}
            </Button>
          );
        })}
      </div>

      <div className="relative my-6">
        <span className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-white/10" />
        </span>
        <span
          className="relative flex justify-center text-xs px-2 font-medium"
          style={{ color: textMuted, backgroundColor: formColor }}
        >
          Or
        </span>
      </div>

      {showMagicLinkForm ? (
        <div className="space-y-4 mb-6">
          {magicLinkSent ? (
            <>
              <Alert>
                <AlertDescription>Check your email for the sign-in link. Click the link to sign in.</AlertDescription>
              </Alert>
              <button
                type="button"
                className="text-xs underline"
                style={{ color: textMuted }}
                onClick={() => {
                  setShowMagicLinkForm(false);
                  setMagicLinkSent(false);
                  setMagicLinkEmail("");
                }}
              >
                Use password or try another email
              </button>
            </>
          ) : (
            <form onSubmit={handleSendMagicLink} className="space-y-4">
              <Label htmlFor="magic-email" className="text-white font-medium text-xs">
                Email for magic link
              </Label>
              <Input
                id="magic-email"
                type="email"
                value={magicLinkEmail}
                onChange={(e) => setMagicLinkEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={magicLinkLoading}
                required
                className="border-white/20 text-white placeholder:text-gray-400 text-xs"
                style={{ backgroundColor: formColor }}
              />
              <div className="flex gap-2">
                <Button
                  type="submit"
                  className="flex-1 text-white text-xs"
                  style={{ backgroundColor: formColor, borderColor: buttonBorder, borderWidth: 1 }}
                  disabled={magicLinkLoading}
                >
                  {magicLinkLoading ? (
                    <>
                      <ButtonLoader className="mr-2" />
                      Sending...
                    </>
                  ) : (
                    "Send magic link"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="text-xs"
                  style={{ borderColor: buttonBorder, color: textMuted }}
                  onClick={() => setShowMagicLinkForm(false)}
                >
                  Back
                </Button>
              </div>
            </form>
          )}
        </div>
      ) : (
        <div className="mb-4">
          <button
            type="button"
            className="text-xs underline"
            style={{ color: textMuted }}
            onClick={() => setShowMagicLinkForm(true)}
          >
            Sign in with magic link
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {message && (
          <Alert variant={message.type === "error" ? "destructive" : "default"}>
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="email" className="text-white font-medium">
            Email Address
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isPending}
            required
            className="w-full pr-10 border-white/20 text-white placeholder:text-gray-400 focus-visible:ring-white/30"
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
            disabled={isPending}
            required
            className="border-white/20 text-white placeholder:text-gray-400 focus-visible:ring-white/30"
            style={{ backgroundColor: formColor }}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <label htmlFor="remember-me" className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: textMuted }}>
            <Checkbox
              id="remember-me"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked === true)}
              disabled={isPending}
              className="size-4 rounded-[4px] border-white/30 data-[state=checked]:bg-white/20 data-[state=checked]:border-white/40"
              iconClassName="size-3.5 shrink-0"
              indicator={<RedCheckIcon className="size-3.5" />}
            />
            Keep me signed in on this device
          </label>
          <Link href="/forgot-password" className="text-xs">
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          className="w-full text-white font-medium hover:opacity-90 text-xs"
          style={{ backgroundColor: formColor, borderColor: buttonBorder, borderWidth: 1 }}
          disabled={isPending}
        >
          {isPending ? (
            <>
              <ButtonLoader className="mr-2" />
              Signing in...
            </>
          ) : (
            "Sign in"
          )}
        </Button>

        <div className="text-center text-xs pt-2" style={{ color: textMuted }}>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium">
            Request Access
          </Link>
        </div>
      </form>
    </AuthPageLayout>
  );
}
