import { Link } from "wouter";
import { AuthPageLayout, AuthLogo, AuthFooter } from "@/components/AuthPageLayout";
import { useAuthBranding } from "@/hooks/useAuthBranding";

export default function ForgotPassword() {
  const branding = useAuthBranding();

  return (
    <AuthPageLayout
      variant="authDark"
      icon={<AuthLogo branding={branding} />}
      title="Password reset"
      description="Authentication is now handled by Clerk. Use the Sign in page and choose Forgot password."
      footer={<AuthFooter branding={branding} />}
    >
      <div className="text-center text-xs" style={{ color: "#9ca3af" }}>
        <Link href="/login" className="underline text-[#9ca3af] hover:text-[#DC2626] transition-colors">
          Return to sign in
        </Link>
      </div>
    </AuthPageLayout>
  );
}
