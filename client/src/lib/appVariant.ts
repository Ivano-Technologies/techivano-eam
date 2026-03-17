/**
 * Host-based app variant for single Vercel project with multiple domains.
 * admin.techivano.com → Admin EAM
 * nrcseam.techivano.com → NRCS EAM
 * techivano.com (apex) → Marketing
 */
export type AppVariant = "admin" | "nrcs" | "marketing";

export function getAppVariant(): AppVariant {
  const host = typeof window !== "undefined" ? window.location.hostname.toLowerCase() : "";
  if (host.includes("admin.techivano.com")) return "admin";
  if (host.includes("nrcseam.techivano.com")) return "nrcs";
  return "marketing";
}

/** True when host is techivano.com or www (apex marketing). */
export function isApexHost(): boolean {
  return getAppVariant() === "marketing";
}
