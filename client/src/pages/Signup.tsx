import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { ButtonLoader } from "@/components/ButtonLoader";
import { AuthPageLayout, AuthLogo, ManusStyleAuthFooter } from "@/components/AuthPageLayout";
import { PasswordStrength, PasswordRequirements } from "@/components/PasswordStrength";
import { Eye, EyeOff } from "lucide-react";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
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

    signupMutation.mutate({
      email: email.trim(),
      name: name.trim(),
      password,
    });
  };

  const isPending = signupMutation.isPending;

  return (
    <AuthPageLayout
      variant="manusDark"
      icon={<AuthLogo />}
      title="Register for NRCS EAM"
      description="Request access; an administrator will review your registration."
      footer={<ManusStyleAuthFooter />}
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
            placeholder="John Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isPending}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
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
            placeholder="you@example.com"
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            disabled={isPending}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative flex items-center">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isPending}
              required
              minLength={8}
              className="pr-10 flex-1 min-w-0 h-10"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((p) => !p)}
              className="no-btn-effect absolute right-0 top-0 bottom-0 w-10 flex items-center justify-center rounded-r text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4 shrink-0" />
              ) : (
                <Eye className="h-4 w-4 shrink-0" />
              )}
            </button>
          </div>
          <PasswordStrength password={password} />
          <PasswordRequirements password={password} />
        </div>

        <div className="flex items-start gap-2">
          <Checkbox
            id="terms"
            checked={agreedToTerms}
            onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
            disabled={isPending}
          />
          <label htmlFor="terms" className="text-sm leading-tight cursor-pointer">
            I agree to the{" "}
            <Link href="/legal/terms">
              Terms of Use
            </Link>{" "}
            and{" "}
            <Link href="/legal/privacy">
              Privacy Policy
            </Link>
          </label>
        </div>

        <Button
          type="submit"
          className="w-full bg-[#DC2626] hover:bg-[#DC2626]/90 text-white"
          disabled={isPending}
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

        <div className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium">
            Sign In
          </Link>
        </div>
      </form>
    </AuthPageLayout>
  );
}
