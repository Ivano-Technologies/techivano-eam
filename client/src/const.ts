export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Generate login URL at runtime so redirect URI reflects the current origin.
// If OAuth env vars are missing (e.g. in deployment), fall back to /login so the app doesn't crash.
export const getLoginUrl = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const hasOAuth =
    typeof oauthPortalUrl === "string" &&
    oauthPortalUrl.length > 0 &&
    typeof appId === "string" &&
    appId.length > 0;
  if (!hasOAuth) {
    return `${window.location.origin}/login`;
  }
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);
  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");
  return url.toString();
};
