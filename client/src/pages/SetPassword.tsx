/**
 * Set password for current user (e.g. after OAuth when they have no password).
 * Route: /set-password?from=oauth&mandatory=1 (mandatory=1 for global owners — no Skip).
 */
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { AlertCircle } from "lucide-react";
import { AuthPageLayout, AuthLogo, ManusStyleAuthFooter } from "@/components/AuthPageLayout";
import { PasswordStrength, PasswordRequirements } from "@/components/PasswordStrength";
import { useAuthBranding } from "@/hooks/useAuthBranding";

export default function SetPassword() {
  const branding = useAuthBranding();
  const [, setLocation] = useLocation();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const search = typeof window !== "undefined" ? window.location.search : "";
  const params = new URLSearchParams(search);
  const fromOauth = params.get("from") === "oauth";
  const mandatory = params.get("mandatory") === "1";

  const { data: me, isLoading: meLoading } = trpc.auth.me.useQuery();
  const user = me ?? null;

  const setPasswordMutation = trpc.auth.setPassword.useMutation({
    onSuccess: () => {
      setLocation("/");
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  useEffect(() => {
    if (meLoading) return;
    if (!user) {
      setLocation("/login");
    }
  }, [user, meLoading, setLocation]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setPasswordMutation.mutate({ newPassword });
  };

  if (meLoading || !user) {
    return (
      <AuthPageLayout
        variant="manusDark"
        icon={<AuthLogo branding={branding} />}
        title="Loading..."
        description="Please wait."
        footer={<ManusStyleAuthFooter branding={branding} />}
      >
        <div className="text-sm text-muted-foreground">Please wait.</div>
      </AuthPageLayout>
    );
  }

  const formColor = "#252525";
  const textMuted = "#9ca3af";
  const buttonBorder = "rgba(255,255,255,0.12)";

  return (
    <AuthPageLayout
      variant="manusDark"
      icon={<AuthLogo branding={branding} />}
      title={fromOauth ? "Set a password" : "Set password"}
      description={
        fromOauth
          ? "Set a password for account recovery and signing in with email when needed."
          : "Choose a password for your account."
      }
      footer={<ManusStyleAuthFooter branding={branding} />}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="newPassword" className="text-white font-medium">
            New password
          </Label>
          <Input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            disabled={setPasswordMutation.isPending}
            className="border-white/20 text-white"
            style={{ backgroundColor: formColor }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-white font-medium">
            Confirm password
          </Label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            disabled={setPasswordMutation.isPending}
            className="border-white/20 text-white"
            style={{ backgroundColor: formColor }}
          />
        </div>
        <div className="min-h-[100px] space-y-1">
          <PasswordStrength password={newPassword} />
          <PasswordRequirements password={newPassword} />
        </div>
        {error && (
          <div className="text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        <div className="space-y-3 mt-4">
          <Button
            type="submit"
            className="w-full text-white font-medium"
            style={{ backgroundColor: formColor, borderColor: buttonBorder, borderWidth: 1 }}
            disabled={setPasswordMutation.isPending}
          >
            {setPasswordMutation.isPending ? "Setting password..." : "Set password"}
          </Button>
          {!mandatory && (
            <div className="text-center">
              <Link href="/" className="text-xs" style={{ color: textMuted }}>
                Skip for now
              </Link>
            </div>
          )}
          <div className="flex justify-end pt-2">
            <Link href="/" className="text-xs" style={{ color: textMuted }}>
              Go to dashboard
            </Link>
          </div>
        </div>
      </form>
    </AuthPageLayout>
  );
}
