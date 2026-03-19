/**
 * Cloudflare Turnstile server-side verification.
 * @see https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */
import { ENV } from "./env";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileVerifyResult =
  | { success: true }
  | { success: false; errorCodes: string[] };

/**
 * Verify a Turnstile response token with Cloudflare.
 * Returns { success: true } if valid; otherwise { success: false, errorCodes }.
 * If TURNSTILE_SECRET_KEY is not set, returns success (verification skipped for dev).
 */
export async function verifyTurnstileToken(
  responseToken: string | null | undefined,
  remoteip?: string | null
): Promise<TurnstileVerifyResult> {
  if (!ENV.turnstileSecretKey) {
    return { success: true };
  }
  if (!responseToken?.trim()) {
    return { success: false, errorCodes: ["missing-input-response"] };
  }

  const body = new URLSearchParams({
    secret: ENV.turnstileSecretKey,
    response: responseToken.trim(),
  });
  if (remoteip) body.set("remoteip", remoteip);

  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      body: body.toString(),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (data.success === true) {
      return { success: true };
    }
    return {
      success: false,
      errorCodes: Array.isArray(data["error-codes"]) ? data["error-codes"] : ["unknown"],
    };
  } catch (err) {
    console.error("[turnstile] siteverify request failed", err);
    return { success: false, errorCodes: ["request-failed"] };
  }
}
