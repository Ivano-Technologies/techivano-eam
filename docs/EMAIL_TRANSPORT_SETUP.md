# Email transport setup (for later)

Use this when you are ready to configure email sending (e.g. password reset, magic links).

---

## Option A — Forge (Manus)

1. Get API URL and key from the Manus dashboard.
2. Set in your environment (e.g. `.env` or hosting dashboard):

```env
BUILT_IN_FORGE_API_URL=https://your-forge-api-url
BUILT_IN_FORGE_API_KEY=your-forge-api-key
```

---

## Option B — SMTP

1. Choose an SMTP provider (e.g. SendGrid, Mailgun, AWS SES, or your own SMTP server).
2. Create credentials (host, port, user, password) and a sender address.
3. Set in your environment:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
EMAIL_FROM=noreply@yourdomain.com
```

- `SMTP_HOST` is required. Others are optional (e.g. omit auth if your server does not use it).
- `EMAIL_FROM` defaults to `SMTP_USER` or `noreply@nrcs.org.ng` if not set.

---

## Reset link base URL (production)

So password reset links point to your live site:

```env
VITE_APP_URL=https://techivano.com
```

On Vercel, `VERCEL_URL` is used if `VITE_APP_URL` is not set.

---

## Quick check

- **Forge:** Both `BUILT_IN_FORGE_API_URL` and `BUILT_IN_FORGE_API_KEY` must be set.
- **SMTP:** At least `SMTP_HOST` must be set.
- If neither is configured, the app will not send email (e.g. password reset emails will not be sent).
