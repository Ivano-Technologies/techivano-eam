import { Resend } from 'resend';
import { ENV } from './_core/env';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  /** Override from address (must be a verified domain in Resend). */
  from?: string;
  /** Optional friendly name for "From" (e.g. "Techivano EAM" or tenant name). Multi-tenant: set per organization. */
  fromName?: string;
  /** Reply-To address. Multi-tenant: use organization support email so replies go to the right tenant. */
  replyTo?: string;
  /** Optional tags for Resend analytics (e.g. category, organization_id). */
  tags?: Array<{ name: string; value: string }>;
}

/** True if Resend is configured (primary provider for techivano.com). */
export function isResendConfigured(): boolean {
  return Boolean(ENV.resendApiKey?.trim());
}

/** True if Forge (Manus) email API is configured. */
export function isForgeEmailConfigured(): boolean {
  return Boolean(ENV.forgeApiUrl?.trim() && ENV.forgeApiKey?.trim());
}

/** True if SMTP is configured (Phase 70 fallback). */
export function isSmtpConfigured(): boolean {
  return Boolean(ENV.smtpHost?.trim());
}

/** Overall email sending is available (Resend, Forge, or SMTP). */
export function isEmailConfigured(): boolean {
  return isResendConfigured() || isForgeEmailConfigured() || isSmtpConfigured();
}

function buildFromAddress(options: EmailOptions): string {
  const email = options.from ?? ENV.emailFrom;
  const name = options.fromName?.trim();
  if (name) {
    return `${name} <${email}>`;
  }
  return email;
}

async function sendEmailViaResend(options: EmailOptions): Promise<boolean> {
  const resend = new Resend(ENV.resendApiKey);
  const from = buildFromAddress(options);
  const { data, error } = await resend.emails.send({
    from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    replyTo: options.replyTo ?? undefined,
    tags: options.tags ?? undefined,
  });
  if (error) {
    console.error('Resend send failed:', error);
    return false;
  }
  return Boolean(data?.id);
}

async function sendEmailViaForge(options: EmailOptions): Promise<boolean> {
  const response = await fetch(`${ENV.forgeApiUrl}/email/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ENV.forgeApiKey}`,
    },
    body: JSON.stringify({
      to: options.to,
      subject: options.subject,
      html: options.html,
    }),
  });
  if (!response.ok) {
    console.error('Email send failed:', await response.text());
    return false;
  }
  return true;
}

async function sendEmailViaSmtp(options: EmailOptions): Promise<boolean> {
  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.default.createTransport({
      host: ENV.smtpHost,
      port: ENV.smtpPort,
      secure: ENV.smtpPort === 465,
      auth: ENV.smtpUser && ENV.smtpPass ? { user: ENV.smtpUser, pass: ENV.smtpPass } : undefined,
    });
    await transporter.sendMail({
      from: options.from ?? buildFromAddress(options),
      to: options.to,
      subject: options.subject,
      html: options.html,
      replyTo: options.replyTo,
    });
    return true;
  } catch (error) {
    console.error('SMTP send error:', error);
    return false;
  }
}

/**
 * Send email using Resend (primary), then Forge (Manus), then SMTP fallback.
 * Multi-tenant: pass fromName/replyTo per organization when sending on behalf of a tenant.
 * Configure: RESEND_API_KEY + verify techivano.com at https://resend.com/domains; or BUILT_IN_FORGE_*; or SMTP_*.
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    if (isResendConfigured()) {
      return await sendEmailViaResend(options);
    }
    if (isForgeEmailConfigured()) {
      return await sendEmailViaForge(options);
    }
    if (isSmtpConfigured()) {
      return await sendEmailViaSmtp(options);
    }
    console.warn('Email not sent: no provider configured. Set RESEND_API_KEY, BUILT_IN_FORGE_*, or SMTP_* env.');
    return false;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
}

/**
 * Send bulk emails to multiple recipients
 */
export async function sendBulkEmails(
  recipients: string[],
  subject: string,
  html: string
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  // Send emails in batches to avoid overwhelming the service
  const batchSize = 10;
  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    const promises = batch.map(email => sendEmail({ to: email, subject, html }));
    const results = await Promise.all(promises);
    
    sent += results.filter(r => r).length;
    failed += results.filter(r => !r).length;
  }

  return { sent, failed };
}

/**
 * Generate HTML email template
 */
export function generateEmailTemplate(body: string, title?: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title || 'NRCS Notification'}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: #1E3A8A;
      color: white;
      padding: 20px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    .content {
      background: #ffffff;
      padding: 30px;
      border: 1px solid #e5e7eb;
      border-top: none;
    }
    .footer {
      background: #f9fafb;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
      border-radius: 0 0 8px 8px;
    }
    .logo {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 10px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">🏥 NRCS EAM</div>
    <div>${title || 'Notification'}</div>
  </div>
  <div class="content">
    ${body}
  </div>
  <div class="footer">
    <p>This email was sent from NRCS Enterprise Asset Management System</p>
    <p>Nigerian Red Cross Society</p>
  </div>
</body>
</html>
  `.trim();
}
