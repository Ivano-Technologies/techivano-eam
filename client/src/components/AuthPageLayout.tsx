/**
 * Shared layout for auth pages (login, signup, forgot-password, reset-password, auth/callback).
 * Provides a consistent, accessible “glass” card and NRCS branding.
 */
import { type ReactNode, useState } from "react";
import { Link } from "wouter";

/** Logo size (px) used on all auth pages */
const AUTH_LOGO_SIZE_PX = 50;

const AUTH_ACCENT = "#DC2626"; // NRCS red, matches existing auth cards
const MANUS_BG = "#f8f8f7";
// Manus dark theme (account selection / login screen)
const MANUS_DARK_BG = "#1a1a1a";
/** Form/card background for Manus dark — entire form uses this */
const MANUS_DARK_CARD = "#363636";
const MANUS_DARK_ELEMENT = "#363636";
const MANUS_DARK_TEXT = "#ffffff";
const MANUS_DARK_TEXT_MUTED = "#9ca3af";
/** Charcoal grey for "Powered by Techivano" and other footer branding */
const AUTH_FOOTER_CHARCOAL = "#3d3d3d";

type AuthPageLayoutProps = {
  /** Optional icon above the title (e.g. lucide icon in a circle) */
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /** Extra class for the inner card */
  cardClassName?: string;
  /** Max width of the card: "sm" (md) | "lg" (2xl) */
  maxWidth?: "sm" | "lg";
  /** "manus" = light; "manusDark" = dark card + dotted bg, Manus account-screen style */
  variant?: "default" | "manus" | "manusDark";
  /** Footer content when variant is manus or manusDark */
  footer?: ReactNode;
};

export function AuthPageLayout({
  icon,
  title,
  description,
  children,
  cardClassName = "",
  maxWidth = "sm",
  variant = "default",
  footer,
}: AuthPageLayoutProps) {
  const maxWidthClass = maxWidth === "lg" ? "max-w-2xl" : "max-w-md";
  const isManus = variant === "manus" || variant === "manusDark";
  const isManusDark = variant === "manusDark";

  return (
    <div
      className={
        isManus
          ? "min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden"
          : "min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-gray-50 via-gray-100 to-slate-200 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900"
      }
      style={
        isManusDark
          ? { backgroundColor: MANUS_DARK_BG }
          : isManus
            ? { backgroundColor: MANUS_BG }
            : undefined
      }
    >
      {/* Manus dark: dot grid — grey base, then coloured-dot "blobs" that move to create floating shape illusion */}
      {isManusDark && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
          {/* Base: grey dots (static) */}
          <div
            className="absolute inset-0 auth-dots-base"
            style={{ color: `${MANUS_DARK_TEXT_MUTED}44` }}
          />
          {/* Moving blobs: same dot grid in different hues, each revealed only inside a moving circle */}
          <div
            className="auth-dots-blob auth-dots-base"
            style={{ color: "rgba(147, 197, 253, 0.35)" }}
          />
          <div
            className="auth-dots-blob auth-dots-base"
            style={{ color: "rgba(196, 181, 253, 0.3)" }}
          />
          <div
            className="auth-dots-blob auth-dots-base"
            style={{ color: "rgba(253, 186, 116, 0.28)" }}
          />
          <div
            className="auth-dots-blob auth-dots-base"
            style={{ color: "rgba(110, 231, 183, 0.25)" }}
          />
        </div>
      )}
      {!isManus && (
        <div
          className="absolute inset-0 opacity-[0.04] dark:opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
            backgroundSize: "24px 24px",
          }}
          aria-hidden
        />
      )}
      <div
        className={`w-full ${maxWidthClass} relative ${isManusDark ? "auth-card-dark rounded-xl" : isManus ? "rounded-lg border border-gray-200/80 shadow-sm" : "animate-in fade-in slide-in-from-bottom-4 duration-300 rounded-xl border-2 shadow-2xl glass dark:glass-dark"} ${cardClassName}`}
        style={
          isManusDark
            ? { backgroundColor: MANUS_DARK_CARD }
            : !isManus
              ? { borderColor: AUTH_ACCENT }
              : undefined
        }
      >
        <div className={`${isManus ? "p-8 sm:p-10" : "p-6 sm:p-8"} ${isManusDark ? "auth-card-content-dark" : ""}`}>
          {(icon || title) && (
            <header className="text-center mb-6">
              {icon && (
                <div
                  className={`flex justify-center items-center mb-4 ${isManusDark ? "mx-auto shrink-0" : ""}`}
                  style={isManusDark ? { width: AUTH_LOGO_SIZE_PX, height: AUTH_LOGO_SIZE_PX, minWidth: AUTH_LOGO_SIZE_PX, minHeight: AUTH_LOGO_SIZE_PX } : undefined}
                  aria-hidden
                >
                  {icon}
                </div>
              )}
              <h1
                className={`font-bold tracking-tight ${isManusDark ? "text-xl sm:text-2xl auth-title" : isManus ? "text-xl sm:text-2xl" : "text-2xl"} ${isManusDark ? "text-white" : "text-foreground"}`}
              >
                {title}
              </h1>
              {description && (
                <div className={`mt-2 text-sm auth-description ${isManusDark ? "text-[#9ca3af]" : "text-muted-foreground"}`}>
                  {description}
                </div>
              )}
            </header>
          )}
          <div className={isManusDark ? "auth-dark" : ""}>
            {children}
          </div>
        </div>
      </div>
      {isManus && footer !== undefined && (
        <footer
          className={`w-full max-w-md mt-8 px-4 text-center text-xs ${isManusDark ? "auth-footer-dark" : ""}`}
          style={isManusDark ? { color: MANUS_DARK_TEXT_MUTED } : undefined}
        >
          {footer}
        </footer>
      )}
    </div>
  );
}

/** NRCS logo shown on all auth pages (50px). Uses /nrcs-logo.png or VITE_AUTH_LOGO_URL, fallback to "NRCS" circle. */
export function AuthLogo() {
  const [logoError, setLogoError] = useState(false);
  const logoUrl = import.meta.env.VITE_AUTH_LOGO_URL || "/nrcs-logo.png";
  if (logoError) {
    return (
      <AuthIconCircle size="large">
        <span className="font-bold text-white" style={{ fontSize: "0.7rem" }}>NRCS</span>
      </AuthIconCircle>
    );
  }
  return (
    <img
      src={logoUrl}
      alt="NRCS"
      width={AUTH_LOGO_SIZE_PX}
      height={AUTH_LOGO_SIZE_PX}
      className="object-contain block"
      style={{ width: AUTH_LOGO_SIZE_PX, height: AUTH_LOGO_SIZE_PX }}
      onError={() => setLogoError(true)}
    />
  );
}

/** Default Manus-style footer: Powered by, Terms, Privacy, copyright */
export function ManusStyleAuthFooter() {
  const year = new Date().getFullYear();
  return (
    <>
      <p className="auth-footer-powered font-medium" style={{ color: AUTH_FOOTER_CHARCOAL }}>Powered by Techivano</p>
      <p className="mt-2 auth-footer-links">
        <Link href="/legal/terms" className="hover:underline">Terms of service</Link>
        {" · "}
        <Link href="/legal/privacy" className="hover:underline">Privacy policy</Link>
        {" ©" + year + " NRCS EAM"}
      </p>
    </>
  );
}

/** Icon circle used on auth pages (e.g. fallback NRCS). Use size="large" to match auth logo (50px). */
export function AuthIconCircle({
  children,
  variant = "default",
  size = "default",
}: {
  children: ReactNode;
  variant?: "default" | "success" | "error";
  size?: "default" | "large";
}) {
  const bg =
    variant === "success"
      ? "bg-emerald-500/90"
      : variant === "error"
        ? "bg-red-500/90"
        : "bg-blue-500/90";
  const sizeClass = size === "large" ? "" : "w-12 h-12";
  const sizeStyle = size === "large" ? { width: AUTH_LOGO_SIZE_PX, height: AUTH_LOGO_SIZE_PX } : undefined;
  return (
    <div
      className={`rounded-full ${bg} glass-icon flex items-center justify-center text-white ${sizeClass}`}
      style={sizeStyle}
      aria-hidden
    >
      {children}
    </div>
  );
}
