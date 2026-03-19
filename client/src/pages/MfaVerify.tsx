/**
 * Route: /mfa/verify. Re-verify TOTP (e.g. after 12h or for step-up).
 * listFactors → challenge → verify → auth.mfaUpdateVerifiedAt → redirect to app.
 */
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { supabase } from "@/lib/supabase";
import { AuthPageLayout, AuthLogo, AuthFooter } from "@/components/AuthPageLayout";
import { useAuthBranding } from "@/hooks/useAuthBranding";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function MfaVerify() {
  const branding = useAuthBranding();
  const [, setLocation] = useLocation();
  const [verifyCode, setVerifyCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [factorId, setFactorId] = useState<string | null>(null);

  const updateVerifiedAt = trpc.auth.mfaUpdateVerifiedAt.useMutation({
    onSuccess: () => {
      setLocation("/");
    },
    onError: (e) => {
      setError(e.message);
    },
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError("");
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (cancelled) return;
      if (listError) {
        setError(listError.message);
        setLoading(false);
        return;
      }
      const totp = data?.totp?.[0];
      if (totp?.id) {
        setFactorId(totp.id);
      } else {
        setError("No TOTP factor found. Set up MFA first.");
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = async () => {
    setError("");
    if (!factorId || !verifyCode.trim()) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) {
        setError(challenge.error.message);
        return;
      }
      const challengeId = challenge.data.id;
      const verify = await supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code: verifyCode.trim(),
      });
      if (verify.error) {
        setError(verify.error.message);
        return;
      }
      await updateVerifiedAt.mutateAsync();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed.");
    }
  };

  if (loading) {
    return (
      <AuthPageLayout
        variant="authDark"
        icon={<AuthLogo branding={branding} />}
        title="Verify your identity"
        description="Loading…"
        footer={<AuthFooter branding={branding} />}
      >
        <div className="text-sm text-muted-foreground">Please wait.</div>
      </AuthPageLayout>
    );
  }

  if (!factorId) {
    return (
      <AuthPageLayout
        variant="authDark"
        icon={<AuthLogo branding={branding} />}
        title="Verify your identity"
        description={error || "No authenticator set up."}
        footer={<AuthFooter branding={branding} />}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{error || "No authenticator set up."}</p>
          <Button variant="outline" onClick={() => setLocation("/mfa/setup")}>
            Set up MFA
          </Button>
        </div>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout
      variant="authDark"
      icon={<AuthLogo branding={branding} />}
      title="Verify your identity"
      description="Enter the 6-digit code from your authenticator app."
      footer={<AuthFooter branding={branding} />}
    >
      <div className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="space-y-2">
          <Label htmlFor="mfa-verify-code">Verification code</Label>
          <Input
            id="mfa-verify-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            maxLength={6}
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            disabled={updateVerifiedAt.isPending}
          />
        </div>
        <Button
          className="w-full"
          onClick={handleSubmit}
          disabled={updateVerifiedAt.isPending || verifyCode.length !== 6}
        >
          {updateVerifiedAt.isPending ? "Verifying…" : "Verify"}
        </Button>
      </div>
    </AuthPageLayout>
  );
}
