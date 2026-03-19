/**
 * Route: /mfa/setup. Global owners (and optional admins) set up TOTP.
 * Supabase enroll → show QR + secret → user enters code → verify → auth.mfaConfirmEnrollment.
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

export default function MfaSetup() {
  const branding = useAuthBranding();
  const [, setLocation] = useLocation();
  const [factorId, setFactorId] = useState<string>("");
  const [qrSvg, setQrSvg] = useState<string>("");
  const [secret, setSecret] = useState<string>("");
  const [verifyCode, setVerifyCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  const confirmEnrollment = trpc.auth.mfaConfirmEnrollment.useMutation({
    onSuccess: () => {
      setLocation("/");
    },
    onError: (e) => {
      setError(e.message);
      setVerifying(false);
    },
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError("");
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
      });
      if (cancelled) return;
      if (enrollError) {
        setError(enrollError.message);
        setLoading(false);
        return;
      }
      if (data?.id) setFactorId(data.id);
      if (data?.totp?.qr_code) setQrSvg(data.totp.qr_code);
      if (data?.totp?.secret) setSecret(data.totp.secret);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const handleEnable = async () => {
    setError("");
    if (!factorId || !verifyCode.trim()) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setVerifying(true);
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) {
        setError(challenge.error.message);
        setVerifying(false);
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
        setVerifying(false);
        return;
      }
      await confirmEnrollment.mutateAsync();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed.");
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <AuthPageLayout
        variant="authDark"
        icon={<AuthLogo branding={branding} />}
        title="Set up two-factor authentication"
        description="Loading…"
        footer={<AuthFooter branding={branding} />}
      >
        <div className="text-sm text-muted-foreground">Please wait.</div>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout
      variant="authDark"
      icon={<AuthLogo branding={branding} />}
      title="Set up two-factor authentication"
      description="Scan the QR code with your authenticator app (Google Authenticator, 1Password, etc.), then enter the 6-digit code."
      maxWidth="sm"
      footer={<AuthFooter branding={branding} />}
    >
      <div className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {qrSvg && (
          <div className="flex justify-center bg-white p-4 rounded-lg">
            <img
              src={`data:image/svg+xml;base64,${btoa(qrSvg)}`}
              alt="QR code for authenticator app"
              className="w-48 h-48"
            />
          </div>
        )}
        {secret && (
          <p className="text-sm text-muted-foreground break-all text-center">
            Or enter this secret manually: <code className="bg-muted px-1 rounded">{secret}</code>
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="mfa-code">Verification code</Label>
          <Input
            id="mfa-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            maxLength={6}
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            disabled={verifying || confirmEnrollment.isPending}
          />
        </div>
        <div className="flex gap-2">
          <Button
            className="flex-1"
            onClick={handleEnable}
            disabled={verifying || confirmEnrollment.isPending || verifyCode.length !== 6}
          >
            {verifying || confirmEnrollment.isPending ? "Verifying…" : "Enable"}
          </Button>
          <Button variant="outline" onClick={() => setLocation("/login")} disabled={verifying || confirmEnrollment.isPending}>
            Cancel
          </Button>
        </div>
      </div>
    </AuthPageLayout>
  );
}
