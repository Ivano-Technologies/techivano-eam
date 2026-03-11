/**
 * Phase 70: Email templates for password reset, welcome, and magic link.
 * Use with generateEmailTemplate() from emailService for consistent layout.
 */

import { generateEmailTemplate } from "./emailService";

export function getPasswordResetEmailBody(resetLink: string): string {
  return `
    <p>You requested a password reset. Click the link below to set a new password (link expires in 1 hour):</p>
    <p><a href="${resetLink}">${resetLink}</a></p>
    <p>If you did not request this, ignore this email.</p>
  `.trim();
}

export function getWelcomeEmailBody(userName: string, loginUrl: string): string {
  return `
    <p>Welcome to NRCS Enterprise Asset Management, ${userName}.</p>
    <p>Your account has been approved. You can sign in here:</p>
    <p><a href="${loginUrl}">${loginUrl}</a></p>
  `.trim();
}

export function getMagicLinkEmailBody(magicLink: string): string {
  return `
    <p>Click the link below to sign in (no password needed):</p>
    <p><a href="${magicLink}">${magicLink}</a></p>
    <p>If you didn't request this email, you can safely ignore it.</p>
  `.trim();
}

/** Rendered password reset email HTML (uses shared template). */
export function renderPasswordResetEmail(resetLink: string): string {
  return generateEmailTemplate(getPasswordResetEmailBody(resetLink), "Password Reset");
}

/** Rendered welcome email HTML. */
export function renderWelcomeEmail(userName: string, loginUrl: string): string {
  return generateEmailTemplate(getWelcomeEmailBody(userName, loginUrl), "Welcome");
}

/** Rendered magic link email HTML. */
export function renderMagicLinkEmail(magicLink: string): string {
  return generateEmailTemplate(getMagicLinkEmailBody(magicLink), "Sign-in link");
}
