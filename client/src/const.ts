export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/** Login page URL. Used for unauthenticated redirects (Supabase Auth). */
export const getLoginUrl = () => `${typeof window !== "undefined" ? window.location.origin : ""}/login`;
