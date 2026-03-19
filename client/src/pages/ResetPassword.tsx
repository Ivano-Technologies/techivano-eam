import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { AlertCircle } from "lucide-react";
import { AuthPageLayout, AuthLogo, AuthFooter } from "@/components/AuthPageLayout";
import { PasswordStrength, PasswordRequirements } from "@/components/PasswordStrength";
import { useAuthBranding } from "@/hooks/useAuthBranding";

export default function ResetPassword() {
  const branding = useAuthBranding();
  const [, setLocation] = useLocation();
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Extract token from URL query params
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get("token");
    if (tokenParam) {
      setToken(tokenParam);
    } else {
      setError("Invalid or expired link.");
    }
  }, []);

  const resetPassword = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      setSuccess(true);
      setTimeout(() => {
        setLocation("/login");
      }, 3000);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    resetPassword.mutate({ token, newPassword });
  };

  if (success) {
    return (
      <AuthPageLayout
        variant="authDark"
        icon={<AuthLogo branding={branding} />}
        title="Password Reset Successful"
        description="Your password has been reset successfully. Redirecting to login..."
        footer={<AuthFooter branding={branding} />}
      >
        <Link href="/login">
          <Button className="w-full bg-[#DC2626] hover:bg-[#DC2626]/90 text-white">Go to Login</Button>
        </Link>
      </AuthPageLayout>
    );
  }

  if (!token || error.includes("Invalid or expired")) {
    return (
      <AuthPageLayout
        variant="authDark"
        icon={<AuthLogo branding={branding} />}
        title="Invalid or Expired Link"
        description="This link is invalid or has expired. Request a new reset link below or go back to login."
        footer={<AuthFooter branding={branding} />}
      >
        <div className="space-y-3">
          <Link href="/forgot-password">
            <Button className="w-full bg-[#DC2626] hover:bg-[#DC2626]/90 text-white">Request new reset link</Button>
          </Link>
          <div className="flex justify-end pt-2">
            <Link href="/login" className="text-xs underline text-[#9ca3af] hover:text-[#DC2626] transition-colors">
              Back to Login
            </Link>
          </div>
        </div>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout
      variant="authDark"
      icon={<AuthLogo branding={branding} />}
      title="Set New Password"
      footer={<AuthFooter branding={branding} />}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="newPassword">New password</Label>
          <Input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            disabled={resetPassword.isPending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            disabled={resetPassword.isPending}
          />
        </div>

        {/* Strength + rules after confirm; reserved min-height so layout doesn't shift when they appear */}
        <div className="min-h-[132px] space-y-1">
          <PasswordStrength password={newPassword} />
          <PasswordRequirements password={newPassword} />
        </div>

        {error && (
          <div className="text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-4 mt-6">
          <Button
            type="submit"
            className="w-full bg-[#DC2626] hover:bg-[#DC2626]/90 text-white"
            disabled={resetPassword.isPending}
          >
            {resetPassword.isPending ? "Setting password..." : "Set new password"}
          </Button>

          <div className="flex justify-end pt-5">
            <Link href="/login" className="text-xs underline text-[#9ca3af] hover:text-[#DC2626] transition-colors">
              Back to Login
            </Link>
          </div>
        </div>
      </form>
    </AuthPageLayout>
  );
}
