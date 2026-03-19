export const COOKIE_NAME = "app_session_id";
/** Session row id cookie for device/session tracking and revoke. */
export const SESSION_COOKIE_NAME = "app_session_uuid";
/** Dev-only: bypass auth and act as dev admin (hostname GM AMPD + NODE_ENV=development). */
export const DEV_BYPASS_COOKIE_NAME = "app_dev_bypass";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';
