/**
 * Shared layout for auth pages (login, signup, forgot-password, reset-password, auth/callback).
 * Provides a consistent, accessible “glass” card and NRCS branding.
 */
import type { ReactNode } from "react";

const AUTH_ACCENT = "#DC2626"; // NRCS red, matches existing auth cards

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
};

export function AuthPageLayout({
  icon,
  title,
  description,
  children,
  cardClassName = "",
  maxWidth = "sm",
}: AuthPageLayoutProps) {
  const maxWidthClass = maxWidth === "lg" ? "max-w-2xl" : "max-w-md";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-gray-50 via-gray-100 to-slate-200 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Subtle pattern for depth */}
      <div
        className="absolute inset-0 opacity-[0.04] dark:opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
          backgroundSize: "24px 24px",
        }}
        aria-hidden
      />
      <div
        className={`w-full ${maxWidthClass} relative animate-in fade-in slide-in-from-bottom-4 duration-300 rounded-xl border-2 shadow-2xl glass dark:glass-dark ${cardClassName}`}
        style={{ borderColor: AUTH_ACCENT }}
      >
        <div className="p-6 sm:p-8">
          {(icon || title) && (
            <header className="text-center mb-6">
              {icon && (
                <div className="flex justify-center mb-4">{icon}</div>
              )}
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {title}
              </h1>
              {description && (
                <div className="mt-2 text-sm text-muted-foreground">
                  {description}
                </div>
              )}
            </header>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

/** Icon circle used on auth pages (e.g. Mail, Lock, CheckCircle) */
export function AuthIconCircle({
  children,
  variant = "default",
}: {
  children: ReactNode;
  variant?: "default" | "success" | "error";
}) {
  const bg =
    variant === "success"
      ? "bg-emerald-500/90"
      : variant === "error"
        ? "bg-red-500/90"
        : "bg-blue-500/90";
  return (
    <div
      className={`mx-auto w-12 h-12 rounded-full ${bg} glass-icon flex items-center justify-center text-white`}
      aria-hidden
    >
      {children}
    </div>
  );
}
