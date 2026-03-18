/**
 * Email domain whitelist for signup (HIGH-8).
 * Only signups from allowed domains are accepted unless OPEN_SIGNUP is set or an admin creates the user.
 * When req is provided, allowed domains are chosen by host (admin.techivano.com → Ivano, nrcseam.techivano.com → NRCS).
 */
import { ENV } from "./env";

type RequestLike = { headers: Record<string, string | string[] | undefined> };

function getHost(req: RequestLike): string {
  const raw = (req.headers["x-forwarded-host"] ?? req.headers.host) ?? "";
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (value ?? "").split(":")[0].trim().toLowerCase();
}

/** Allowed signup domains for the request's host (admin / nrcs subdomain or default). */
export function getAllowedSignupDomainsForRequest(req?: RequestLike | null): string[] {
  if (!req) return ENV.allowedSignupDomains;
  const host = getHost(req);
  if (host === "admin.techivano.com") return ENV.allowedDomainsAdmin;
  if (host === "nrcseam.techivano.com") return ENV.allowedDomainsNrcs;
  return ENV.allowedSignupDomains;
}

/**
 * Returns true if the email domain is allowed for signup, or if open signup is enabled.
 * When req is provided, uses per-host allowed domains (admin.techivano.com / nrcseam.techivano.com).
 * Admin-created users (via users.create) are not subject to this check.
 */
export function isAllowedSignupEmail(email: string, req?: RequestLike | null): boolean {
  if (ENV.openSignup) return true;
  const domain = email.split("@")[1]?.trim().toLowerCase();
  if (!domain) return false;
  const allowed = req ? getAllowedSignupDomainsForRequest(req) : ENV.allowedSignupDomains;
  return allowed.includes(domain);
}

/** Human-readable list of allowed domains for error messages. Optional req for per-host message. */
export function getAllowedDomainsMessage(req?: RequestLike | null): string {
  if (ENV.openSignup) return "Signup is open for all domains.";
  const allowed = req ? getAllowedSignupDomainsForRequest(req) : ENV.allowedSignupDomains;
  return allowed.length
    ? `Allowed domains: ${allowed.join(", ")}`
    : "No signup domains configured.";
}
