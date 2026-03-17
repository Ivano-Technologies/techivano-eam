/** Session storage key for impersonation token (sent as x-impersonation header). */
export const IMPERSONATION_STORAGE_KEY = "impersonation_token";

export function getImpersonationToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(IMPERSONATION_STORAGE_KEY);
}

export function setImpersonationToken(token: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(IMPERSONATION_STORAGE_KEY, token);
}

export function clearImpersonationToken(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(IMPERSONATION_STORAGE_KEY);
}
