import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AuthPageLayout, AuthLogo, AuthFooter } from "@/components/AuthPageLayout";
import { useAuthBranding } from "@/hooks/useAuthBranding";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function VerifyMagicLink() {
  const branding = useAuthBranding();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      setStatus("error");
      setMessage("Invalid or missing verification token");
      return;
    }

    fetch("/api/auth/verify-magic-link", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => res.json().catch(() => ({})))
      .then((data) => {
        if (data.success && typeof data.redirectTo === "string" && data.redirectTo) {
          setStatus("success");
          setMessage("Verifying link and signing you in...");
          window.location.href = data.redirectTo;
        } else {
          setStatus("error");
          setMessage(
            data.message ||
              "Unable to verify this sign-in link. Please request a new link."
          );
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage(
          "Unable to verify this link. Please go to the sign-in page and use \"Send magic link\" to receive a new link."
        );
      });
  }, []);

  if (status === "verifying") {
    return (
      <AuthPageLayout
        variant="authDark"
        icon={<AuthLogo branding={branding} />}
        title="Verifying..."
        description="Please wait while we verify your magic link."
        footer={<AuthFooter branding={branding} />}
      >
        <div className="flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#9ca3af]" aria-hidden />
        </div>
      </AuthPageLayout>
    );
  }

  if (status === "success") {
    return (
      <AuthPageLayout
        variant="authDark"
        icon={<AuthLogo branding={branding} />}
        title="Success!"
        description={message}
        footer={<AuthFooter branding={branding} />}
      >
        <div className="flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#9ca3af]" aria-hidden />
        </div>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout
      variant="authDark"
      icon={<AuthLogo branding={branding} />}
      title=""
      description={message}
      footer={<AuthFooter branding={branding} />}
    >
      <Button asChild className="w-full bg-[#DC2626] hover:bg-[#DC2626]/90 text-white">
        <Link href="/login">Return to sign in</Link>
      </Button>
    </AuthPageLayout>
  );
}
