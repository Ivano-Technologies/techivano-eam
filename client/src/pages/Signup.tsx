import { useState } from "react";
import { Link } from "wouter";
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
  const branding = useAuthBranding();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [designation, setDesignation] = useState("");
  const [password, setPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const signupMutation = trpc.auth.signupWithPassword.useMutation({
    onSuccess: () => {
      setMessage({
        type: "success",
        text: "Registration submitted. An administrator will review your request and you'll receive an email once approved.",
      });
      setName("");
      setEmail("");
      setConfirmEmail("");
      setPassword("");
      setAgreedToTerms(false);
    },
    onError: (error) => {
      setMessage({ type: "error", text: error.message || "Registration failed. Please try again." });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

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

    signupMutation.mutate({
      email: email.trim(),
      name: name.trim(),
      password,
      turnstileToken: turnstileToken || undefined,
      agency: organization.trim() || undefined,
      jobTitle: designation.trim() || undefined,
    });
  };

  const isPending = signupMutation.isPending;

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
              Submitting...
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
