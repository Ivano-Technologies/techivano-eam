/**
 * Single EAM app at techivano.com. Marketing and admin/nrcseam subdomains disabled.
 * All hosts serve NRCS EAM; auth is simplified to one site (techivano.com).
 */
export type AppVariant = "admin" | "nrcs" | "marketing";

export function getAppVariant(): AppVariant {
  // Always EAM app; marketing (Next.js) and subdomain variants disabled.
  return "nrcs";
}

/** True when host is techivano.com or www (main EAM site). */
export function isApexHost(): boolean {
  const host = typeof window !== "undefined" ? window.location.hostname.toLowerCase() : "";
  return host === "techivano.com" || host === "www.techivano.com";
}
