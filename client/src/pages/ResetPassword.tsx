import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { AlertCircle } from "lucide-react";
import { AuthPageLayout, AuthLogo, ManusStyleAuthFooter } from "@/components/AuthPageLayout";

export default function ResetPassword() {
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
      setError("Invalid reset link. Please request a new password reset.");
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
        variant="manusDark"
        icon={<AuthLogo />}
        title="Password Reset Successful"
        description="Your password has been reset successfully. Redirecting to login..."
        footer={<ManusStyleAuthFooter />}
      >
        <Link href="/login">
          <Button className="w-full bg-[#DC2626] hover:bg-[#DC2626]/90 text-white">Go to Login</Button>
        </Link>
      </AuthPageLayout>
    );
  }

  if (!token || error.includes("Invalid reset link")) {
    return (
      <AuthPageLayout
        variant="manusDark"
        icon={<AuthLogo />}
        title="Invalid Reset Link"
        description="This password reset link is invalid or has expired."
        footer={<ManusStyleAuthFooter />}
      >
        <div className="space-y-3">
          <Link href="/forgot-password">
            <Button className="w-full bg-[#DC2626] hover:bg-[#DC2626]/90 text-white">Request New Reset Link</Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" className="w-full">Back to Login</Button>
          </Link>
        </div>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout
      variant="manusDark"
      icon={<AuthLogo />}
      title="Reset Your Password"
      description="Enter your new password below (minimum 8 characters)."
      footer={<ManusStyleAuthFooter />}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="newPassword">New Password</Label>
          <Input
            id="newPassword"
            type="password"
            placeholder="Enter new password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            disabled={resetPassword.isPending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            disabled={resetPassword.isPending}
          />
        </div>

        {error && (
          <div className="text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <Button
          type="submit"
          className="w-full bg-[#DC2626] hover:bg-[#DC2626]/90 text-white"
          disabled={resetPassword.isPending}
        >
          {resetPassword.isPending ? "Resetting..." : "Reset Password"}
        </Button>

        <div className="text-center">
          <Link href="/login">
            <Button variant="link" className="text-sm">Back to Login</Button>
          </Link>
        </div>
      </form>
    </AuthPageLayout>
  );
}
