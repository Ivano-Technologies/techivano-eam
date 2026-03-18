import { Request, Response } from "express";
import { verifyMagicLinkToken } from "../magicLinkAuth";
import * as db from "../db";

/**
 * Handle magic link verification endpoint.
 * Option A (Supabase magic link only): this endpoint no longer sets a session cookie.
 * Old app-generated magic links return a deprecation message; users should use the
 * sign-in page "Send magic link" (Supabase) for passwordless sign-in.
 */
export async function handleMagicLinkVerification(req: Request, res: Response) {
  try {
    const token = req.query.token as string;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Missing verification token",
        deprecated: true,
      });
    }

    const userId = await verifyMagicLinkToken(token);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired magic link",
        deprecated: true,
      });
    }

    const user = await db.getRootUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        deprecated: true,
      });
    }

    // Do not set a cookie; session is Supabase-only. Direct user to new flow.
    return res.json({
      success: false,
      message:
        "This sign-in link is no longer supported. Please go to the sign-in page and use \"Send magic link\" to receive a new link.",
      deprecated: true,
    });
  } catch (error) {
    console.error("Magic link verification error:", error);
    return res.status(500).json({
      success: false,
      message: "Verification failed",
      deprecated: true,
    });
  }
}
