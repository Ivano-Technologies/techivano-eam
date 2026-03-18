import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ButtonLoader } from "@/components/ButtonLoader";
import { supabase } from "@/lib/supabase";
import { AuthPageLayout, AuthLogo, ManusStyleAuthFooter } from "@/components/AuthPageLayout";
import { useAuthBranding } from "@/hooks/useAuthBranding";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const useSupabaseAuth = typeof supabaseUrl === "string" && supabaseUrl.length > 0;

export default function Login() {
  const branding = useAuthBranding();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSendMagicLink = async (e: FormEvent) => {
    e.preventDefault();
    if (!useSupabaseAuth || !email.trim()) return;
    setMessage(null);
    setLoading(true);
    try {
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirectTo },
      });
      if (error) {
        setMessage({ type: "error", text: error.message });
        return;
      }
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
      variant="manusDark"
      icon={<AuthLogo branding={branding} />}
      title={signInTitle}
      footer={<ManusStyleAuthFooter branding={branding} />}
    >
      {message && (
        <Alert variant={message.type === "error" ? "destructive" : "default"} className="mb-4">
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {sent ? (
        <div className="space-y-4">
          <Alert>
            <AlertDescription>
              Check your email for the sign-in link. Click the link to sign in.
            </AlertDescription>
          </Alert>
          <button
            type="button"
            className="text-xs underline"
            style={{ color: textMuted }}
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
        <form onSubmit={handleSendMagicLink} className="space-y-4">
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
              disabled={loading}
              required
              className="w-full border-white/20 text-white placeholder:text-gray-400 focus-visible:ring-white/30"
              style={{ backgroundColor: formColor }}
            />
          </div>

          <Button
            type="submit"
            className="w-full text-white font-medium hover:opacity-90 text-xs"
            style={{ backgroundColor: formColor, borderColor: buttonBorder, borderWidth: 1 }}
            disabled={loading || !useSupabaseAuth}
          >
            {loading ? (
              <>
                <ButtonLoader className="mr-2" />
                Sending...
              </>
            ) : (
              "Send magic link"
            )}
          </Button>

          <div className="text-center text-xs pt-2" style={{ color: textMuted }}>
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-medium">
              Request Access
            </Link>
          </div>
        </form>
      )}
    </AuthPageLayout>
  );
}
