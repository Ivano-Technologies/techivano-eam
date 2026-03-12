import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { ArrowLeft } from "lucide-react";
import { AuthPageLayout, AuthLogo, ManusStyleAuthFooter } from "@/components/AuthPageLayout";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const requestReset = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: () => {
      setSubmitted(true);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    requestReset.mutate({ email });
  };

  if (submitted) {
    return (
      <AuthPageLayout
        variant="manusDark"
        icon={<AuthLogo />}
        title="Check Your Email"
        description={
          <>
            If an account exists with <strong>{email}</strong>, you will receive a password reset link shortly.
          </>
        }
        footer={<ManusStyleAuthFooter />}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            The link will expire in 15 minutes for security reasons.
          </p>
          <Link href="/login">
            <Button variant="outline" className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Login
            </Button>
          </Link>
        </div>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout
      variant="manusDark"
      icon={<AuthLogo />}
      title="Forgot Password?"
      description="Enter your email address and we'll send you a link to reset your password."
      footer={<ManusStyleAuthFooter />}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            placeholder="your.email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={requestReset.isPending}
          />
        </div>

        {requestReset.error && (
          <div className="text-sm text-destructive">
            {requestReset.error.message}
          </div>
        )}

        <Button
          type="submit"
          className="w-full bg-[#DC2626] hover:bg-[#DC2626]/90 text-white"
          disabled={requestReset.isPending}
        >
          {requestReset.isPending ? "Sending..." : "Send Reset Link"}
        </Button>

        <div className="text-center">
          <Link href="/login">
            <Button variant="link" className="text-sm text-[#DC2626]">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Login
            </Button>
          </Link>
        </div>
      </form>
    </AuthPageLayout>
  );
}
