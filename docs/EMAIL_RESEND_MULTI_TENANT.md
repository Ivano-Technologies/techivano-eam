# Email Setup: Resend + Multi-Tenant (Techivano EAM)

This document describes the recommended email configuration for Techivano EAM using [Resend](https://resend.com) and how it fits the multi-tenant architecture.

## 1. Resend as Primary Provider

- **Priority order:** Resend → Forge (Manus) → SMTP. When `RESEND_API_KEY` is set, all transactional email (password reset, magic links, notifications) is sent via Resend.
- **Domain:** Verify **techivano.com** in the [Resend Domains](https://resend.com/domains) dashboard. Use a from address on that domain (e.g. `noreply@techivano.com` or `eam@techivano.com`).
- **API key:** Create at [Resend API Keys](https://resend.com/api-keys) and set `RESEND_API_KEY` in your environment. Never commit the key.

### Env vars

```env
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=noreply@techivano.com
```

## 2. Multi-Tenant Email Strategy

Techivano EAM serves multiple organizations (tenants). Recommended approach:

### Single sending domain (techivano.com)

- Use **one Resend account** and **one verified domain** (techivano.com) for all tenants.
- Keeps setup simple, avoids per-tenant domain verification, and preserves deliverability and a single place to manage bounces/complaints.

### Tenant-specific branding and replies

- **From name:** Use the optional `fromName` in `EmailOptions` so the “From” line can show the tenant or product name (e.g. “NRCS EAM” vs “Acme Corp EAM”) while still sending from `noreply@techivano.com`.
- **Reply-To:** Use the optional `replyTo` in `EmailOptions` so replies go to the right tenant (e.g. support@client.com or a tenant-configured address). Resolve this from `ctx.organizationId` and your organization/settings store when sending.

### Optional: per-organization settings (future)

- Store per-organization overrides in the DB (e.g. `reply_to_email`, `from_name`) and pass them into `sendEmail()` when the request context has an `organizationId`. If not set, fall back to app defaults.

### Tags for analytics

- Pass `tags` in `EmailOptions` (e.g. `{ name: 'organization_id', value: organizationId }`) so Resend analytics and webhooks can segment by tenant.

## 3. Usage in Code

```ts
import { sendEmail } from './emailService';

// Simple (uses default from/replyTo)
await sendEmail({ to: user.email, subject: 'Reset password', html: body });

// Multi-tenant: set from name and reply-to per organization
await sendEmail({
  to: user.email,
  subject: 'Reset password',
  html: body,
  fromName: orgSettings?.emailFromName ?? 'Techivano EAM',
  replyTo: orgSettings?.replyToEmail,
  tags: organizationId ? [{ name: 'organization_id', value: organizationId }] : undefined,
});
```

## 4. Where Email Is Sent

- **Auth:** Password reset (`auth.requestPasswordReset`), magic link (`magicLinkAuth.sendMagicLink`).
- **Notifications:** Bulk email via `emailNotifications.send` and any warranty/alert flows that call `sendEmail` / `sendBulkEmails`.

When adding new flows, pass `organizationId` (and optional `fromName` / `replyTo`) from context so multi-tenant behavior stays consistent.

## 5. Resend Dashboard

- **Domains:** [resend.com/domains](https://resend.com/domains) — verify techivano.com and add the DNS records Resend provides.
- **API keys:** [resend.com/api-keys](https://resend.com/api-keys) — create a key with “Send” permission; use it only on the server.
- **Logs:** Use the Resend dashboard to inspect delivery and bounces.

## 6. Rate Limits

Resend default is 2 requests/second per team. For bulk sends (e.g. `sendBulkEmails`), the existing batching (e.g. 10 per batch) helps stay under limits; if you scale up, consider Resend’s higher limits or a queue with rate limiting.
