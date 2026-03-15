/**
 * Auth branding variant by host: admin.techivano.com → Ivano/Techivano, else NRCS.
 * Used for login/signup/forgot/reset to show the correct logo and copy.
 */
export type AuthBranding = "nrcs" | "ivano";

export function useAuthBranding(): AuthBranding {
  if (typeof window === "undefined") return "nrcs";
  const host = window.location.hostname.toLowerCase();
  return host === "admin.techivano.com" ? "ivano" : "nrcs";
}
