import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { isEmailConfigured, isForgeEmailConfigured, isResendConfigured, isSmtpConfigured } from "../emailService";

export const systemRouter = router({
  /** Custom Google OAuth start URL when GOOGLE_OAUTH_CLIENT_ID is set (Google shows "continue to EAM"); else null. */
  googleOAuthStartUrl: publicProcedure.query(() => {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
    return { url: clientId ? "/api/auth/google" : null };
  }),

  /** Phase 70: Email configuration status (read-only, for admin UI). */
  emailConfig: adminProcedure.query(() => ({
    resendConfigured: isResendConfigured(),
    forgeConfigured: isForgeEmailConfigured(),
    smtpConfigured: isSmtpConfigured(),
    emailConfigured: isEmailConfigured(),
  })),

  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),
});
