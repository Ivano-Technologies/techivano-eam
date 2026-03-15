import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { ArrowLeft } from "lucide-react";
import { AuthPageLayout, AuthLogo, ManusStyleAuthFooter } from "@/components/AuthPageLayout";
import { useAuthBranding } from "@/hooks/useAuthBranding";

export default function ForgotPassword() {
  const branding = useAuthBranding();
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
        icon={<AuthLogo branding={branding} />}
        title="Check Your Email"
        description={
          <>
            If an account exists with <strong>{email}</strong>, you will receive a password reset link shortly.
          </>
        }
        footer={<ManusStyleAuthFooter branding={branding} />}
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
      icon={<AuthLogo branding={branding} />}
      title="Forgot Password?"
      footer={<ManusStyleAuthFooter branding={branding} />}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
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
          {requestReset.isPending ? "Sending..." : "Send Password Reset Link"}
        </Button>

        <div className="flex justify-end mt-12">
          <Link href="/login" className="text-xs">
            Back to Login
          </Link>
        </div>
      </form>
    </AuthPageLayout>
  );
}
