import { useState } from "react";
import { Link } from "wouter";
import { useAuth, useSignUp } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox, RedCheckIcon } from "@/components/ui/checkbox";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { trpc } from "@/lib/trpc";
import { env } from "@/lib/env";
import { ButtonLoader } from "@/components/ButtonLoader";
import { AuthPageLayout, AuthLogo, AuthFooter } from "@/components/AuthPageLayout";
import { PasswordStrength, PasswordRequirements } from "@/components/PasswordStrength";
import { useAuthBranding } from "@/hooks/useAuthBranding";

const turnstileSiteKey = env.TURNSTILE_SITE_KEY?.trim() ?? "";

export default function Signup() {
  const { isLoaded: authLoaded, signUp, setActive } = useSignUp();
  const { isLoaded: clerkLoaded, isSignedIn, getToken, signOut } = useAuth();
  const branding = useAuthBranding();
  const [signingOut, setSigningOut] = useState(false);
  const [goingToDashboard, setGoingToDashboard] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [designation, setDesignation] = useState("");
  const [password, setPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setSessionMutation = trpc.auth.setSession.useMutation();
  const logoutMutation = trpc.auth.logout.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setIsSubmitting(true);

    if (!name?.trim()) {
      setMessage({ type: "error", text: "Please enter your name" });
      return;
    }
    if (!email?.trim()) {
      setMessage({ type: "error", text: "Please enter your email" });
      return;
    }
    if (email !== confirmEmail) {
      setMessage({ type: "error", text: "Email addresses do not match" });
      return;
    }
    if (password.length < 8) {
      setMessage({ type: "error", text: "Password must be at least 8 characters" });
      return;
    }
    if (!agreedToTerms) {
      setMessage({ type: "error", text: "You must agree to the Terms of Use and Privacy Policy" });
      return;
    }
    if (turnstileSiteKey && !turnstileToken) {
      setMessage({ type: "error", text: "Please complete the verification check." });
      return;
    }

    if (!authLoaded || !signUp) return;
    try {
      const result = await signUp.create({
        emailAddress: email.trim(),
        password,
        firstName: name.trim(),
        unsafeMetadata: {
          organization: organization.trim() || undefined,
          designation: designation.trim() || undefined,
        },
      });
      if (result.status !== "complete" || !result.createdSessionId) {
        // Clerk requires verification (e.g. email); redirect to login. Disable "Verify email address" in Clerk Dashboard for instant sign-in.
        window.location.href = "/login?registered=1";
        return;
      }
      // Instant sign-in: session is complete, sync app session and redirect to dashboard.
      await setActive({ session: result.createdSessionId });
      const token = await getToken();
      if (!token) {
        setMessage({ type: "error", text: "Account created, but no session token was returned." });
        return;
      }
      await setSessionMutation.mutateAsync({ accessToken: token, rememberMe: true });
      window.location.href = "/";
    } catch (error) {
      const msg =
        typeof error === "object" &&
        error &&
        "errors" in error &&
        Array.isArray((error as { errors?: Array<{ message?: string }> }).errors)
          ? (error as { errors: Array<{ message?: string }> }).errors[0]?.message
          : null;
      const isSessionExists = typeof msg === "string" && /session already exists/i.test(msg);
      setMessage({
        type: "error",
        text: isSessionExists
          ? "You're already signed in. Sign out below to register a different account."
          : msg || "Registration failed. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPending = isSubmitting || setSessionMutation.isPending;
  const isSigningIn = setSessionMutation.isPending;

  const handleSignOutToRegister = async () => {
    setSigningOut(true);
    try {
      await logoutMutation.mutateAsync();
      if (typeof signOut === "function") await signOut({ redirectUrl: window.location.origin + "/signup" });
      else window.location.href = "/signup";
    } catch {
      if (typeof signOut === "function") await signOut({ redirectUrl: window.location.origin + "/signup" });
      else window.location.href = "/login";
    } finally {
      setSigningOut(false);
    }
  };

  const handleGoToDashboard = async () => {
    setGoingToDashboard(true);
    try {
      const token = await getToken();
      if (!token) {
        window.location.href = "/login";
        return;
      }
      await setSessionMutation.mutateAsync({ accessToken: token, rememberMe: true });
      window.location.href = "/";
    } catch {
      window.location.href = "/login";
    } finally {
      setGoingToDashboard(false);
    }
  };

  if (clerkLoaded && authLoaded && isSignedIn) {
    return (
      <AuthPageLayout
        variant="authDark"
        icon={<AuthLogo branding={branding} />}
        title={branding === "ivano" ? "Register for Techivano" : "Register for NRCS EAM"}
        footer={<AuthFooter branding={branding} />}
      >
        <div className="space-y-4">
          <Alert>
            <AlertDescription>You're already signed in. Go to the dashboard or sign out to register a different account.</AlertDescription>
          </Alert>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              className="bg-[#DC2626] hover:bg-[#DC2626]/90 text-white"
              disabled={goingToDashboard}
              onClick={handleGoToDashboard}
            >
              {goingToDashboard ? <ButtonLoader className="mr-2 h-4 w-4" /> : null}
              Go to dashboard
            </Button>
            <Button variant="outline" className="border-white/20 text-white hover:bg-white/10" disabled={signingOut} onClick={handleSignOutToRegister}>
              {signingOut ? <ButtonLoader className="mr-2 h-4 w-4" /> : null}
              Sign out to register a different account
            </Button>
          </div>
        </div>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout
      variant="authDark"
      icon={<AuthLogo branding={branding} />}
      title={branding === "ivano" ? "Register for Techivano" : "Register for NRCS EAM"}
      footer={<AuthFooter branding={branding} />}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {message && (
          <Alert variant={message.type === "error" ? "destructive" : "default"}>
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="name">Full Name</Label>
          <Input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isPending}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="organization">Organization</Label>
          <Input
            id="organization"
            type="text"
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
            disabled={isPending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="designation">Designation</Label>
          <Input
            id="designation"
            type="text"
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
            disabled={isPending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isPending}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmEmail">Confirm Email Address</Label>
          <Input
            id="confirmEmail"
            type="email"
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            disabled={isPending}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isPending}
            required
            minLength={8}
          />
          <PasswordStrength password={password} />
          <PasswordRequirements password={password} />
        </div>

        <div className="flex items-center gap-2 justify-center">
          <Checkbox
            id="terms"
            checked={agreedToTerms}
            onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
            disabled={isPending}
            className="size-4 rounded-[4px] border-white/30 data-[state=checked]:bg-white/20 data-[state=checked]:border-white/40"
            iconClassName="size-3.5 shrink-0"
            indicator={<RedCheckIcon className="size-3.5" />}
          />
          <label htmlFor="terms" className="text-xs cursor-pointer leading-tight" style={{ color: "#9ca3af" }}>
            I agree to the{" "}
            <Link href="/legal/terms" className="underline text-[#9ca3af] hover:text-[#DC2626] transition-colors">
              Terms of Use
            </Link>{" "}
            and{" "}
            <Link href="/legal/privacy" className="underline text-[#9ca3af] hover:text-[#DC2626] transition-colors">
              Privacy Policy
            </Link>
          </label>
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

        <Button
          type="submit"
          className="w-full bg-[#DC2626] hover:bg-[#DC2626]/90 text-white"
          disabled={isPending || (!!turnstileSiteKey && !turnstileToken)}
        >
          {isPending ? (
            <>
              <ButtonLoader className="mr-2" />
              {isSigningIn ? "Signing you in…" : "Creating account…"}
            </>
          ) : (
            "Register"
          )}
        </Button>

        <div className="text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium underline text-[#9ca3af] hover:text-[#DC2626] transition-colors">
            Sign In
          </Link>
        </div>
      </form>
    </AuthPageLayout>
  );
}
