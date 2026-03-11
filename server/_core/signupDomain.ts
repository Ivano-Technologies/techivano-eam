/**
 * Email domain whitelist for signup (HIGH-8).
 * Only signups from allowed domains are accepted unless OPEN_SIGNUP is set or an admin creates the user.
 */
import { ENV } from "./env";

/**
 * Returns true if the email domain is allowed for signup, or if open signup is enabled.
 * Admin-created users (via users.create) are not subject to this check.
 */
export function isAllowedSignupEmail(email: string): boolean {
  if (ENV.openSignup) return true;
  const domain = email.split("@")[1]?.trim().toLowerCase();
  if (!domain) return false;
  return ENV.allowedSignupDomains.includes(domain);
}

/** Human-readable list of allowed domains for error messages. */
export function getAllowedDomainsMessage(): string {
  if (ENV.openSignup) return "Signup is open for all domains.";
  return ENV.allowedSignupDomains.length
    ? `Allowed domains: ${ENV.allowedSignupDomains.join(", ")}`
    : "No signup domains configured.";
}
