import { ENV } from "./env";
import { verifyMagicLinkToken } from "./magicLinkTokens";
import * as db from "../db";
import { getSupabaseAdminClient } from "../supabaseAdmin";

function normalizeOrigin(origin: string | null | undefined): string {
  const fallback = ENV.appUrl.replace(/\/+$/, "");
  if (!origin) return fallback;
  try {
    const parsed = new URL(origin);
    if (!/^https?:$/.test(parsed.protocol)) return fallback;
    return parsed.origin.replace(/\/+$/, "");
  } catch {
    return fallback;
  }
}

export type VerifyMagicLinkResult =
  | { success: true; redirectTo: string }
  | { success: false; message: string };

/**
 * Verifies legacy app token and issues a Supabase-hosted sign-in link.
 * No custom JWT is minted here; Supabase remains the source of session truth.
 */
export async function verifyMagicLinkAndCreateSupabaseLink(
  token: string,
  origin?: string | null
): Promise<VerifyMagicLinkResult> {
  const trimmedToken = token.trim();
  if (!trimmedToken) {
    return { success: false, message: "Missing verification token" };
  }

  const userId = await verifyMagicLinkToken(trimmedToken);
  if (!userId) {
    return { success: false, message: "Invalid or expired magic link" };
  }

  const user = await db.getRootUserById(userId);
  if (!user?.email) {
    return { success: false, message: "User not found" };
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return { success: false, message: "Authentication provider is not configured" };
  }

  const appOrigin = normalizeOrigin(origin);
  const redirectTo = `${appOrigin}/auth/callback`;

  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: user.email,
    options: { redirectTo },
  });

  if (error) {
    return { success: false, message: "Could not create sign-in session" };
  }

  const actionLink = (data as { properties?: { action_link?: string } } | null)?.properties
    ?.action_link;

  if (!actionLink) {
    return { success: false, message: "Could not create sign-in session" };
  }

  return { success: true, redirectTo: actionLink };
}
