import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { trpc } from "@/lib/trpc";
import { ButtonLoader } from "@/components/ButtonLoader";
import { supabase } from "@/lib/supabase";
import { AuthPageLayout, AuthLogo, ManusStyleAuthFooter } from "@/components/AuthPageLayout";
import { Eye, EyeOff } from "lucide-react";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const useSupabaseAuth = typeof supabaseUrl === "string" && supabaseUrl.length > 0;

const SOCIAL_PROVIDERS: { id: "google" | "azure"; label: string }[] = [
  { id: "google", label: "Continue with Google" },
  { id: "azure", label: "Continue with Microsoft" },
];

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "azure" | null>(null);

  const setSessionMutation = trpc.auth.setSession.useMutation();
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

  const handleSubmit = async (e: React.FormEvent) => {
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
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setMessage({ type: "error", text: error.message });
          return;
        }
        if (data?.session?.access_token) {
          await setSessionMutation.mutateAsync({
            accessToken: data.session.access_token,
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
    try {
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
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

  const formColor = "#363636"; // entire form card and inputs/buttons
  const textMuted = "#9ca3af";
  const buttonBorder = "rgba(255,255,255,0.12)"; // slightly light grey border on buttons

  return (
    <AuthPageLayout
      variant="manusDark"
      icon={<AuthLogo />}
      title="Continue to NRCS Enterprise Asset Management System"
      footer={<ManusStyleAuthFooter />}
    >
      {/* Google and Microsoft OAuth — only enabled when Supabase is configured */}
      <div className="space-y-2 mb-6">
        {SOCIAL_PROVIDERS.map(({ id, label }) => {
          const isOauthPending = oauthLoading === id;
          return (
            <Button
              key={id}
              type="button"
              variant="outline"
              className="w-full text-white hover:opacity-90 font-medium"
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
                label
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
          className="relative flex justify-center text-xs uppercase px-2 font-medium"
          style={{ color: textMuted, backgroundColor: formColor }}
        >
          Or
        </span>
      </div>

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
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isPending}
            required
            className="pr-10 border-white/20 text-white placeholder:text-gray-400 focus-visible:ring-white/30"
            style={{ backgroundColor: formColor }}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-white font-medium">
            Password
          </Label>
          <div className="relative flex items-center">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isPending}
              required
              className="pr-10 border-white/20 text-white placeholder:text-gray-400 focus-visible:ring-white/30 flex-1 min-w-0 h-10"
              style={{ backgroundColor: formColor }}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((p) => !p)}
              className="no-btn-effect absolute right-0 top-0 bottom-0 w-10 flex items-center justify-center rounded-r hover:bg-white/10"
              style={{ color: textMuted }}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4 shrink-0" />
              ) : (
                <Eye className="h-4 w-4 shrink-0" />
              )}
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-sm">
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          className="w-full text-white font-medium hover:opacity-90"
          style={{ backgroundColor: formColor, borderColor: buttonBorder, borderWidth: 1 }}
          disabled={isPending}
        >
          {isPending ? (
            <>
              <ButtonLoader className="mr-2" />
              Signing in...
            </>
          ) : (
            "Continue"
          )}
        </Button>

        <div className="text-center text-sm pt-2" style={{ color: textMuted }}>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium">
            Request Access
          </Link>
        </div>
      </form>
    </AuthPageLayout>
  );
}
