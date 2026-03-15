# Subdomain setup — CLI steps (Vercel + Supabase)

## Vercel (done via CLI)

Domains were added to the linked project **techivano-eam** with:

```bash
cd /path/to/techivano-eam
vercel link   # if not already linked
vercel domains add admin.techivano.com
vercel domains add nrcseam.techivano.com
```

- **admin.techivano.com** and **nrcseam.techivano.com** are on the project.
- **techivano.com** and **www.techivano.com** were already assigned to a project (no change).
- Supabase redirect URLs for admin and nrcseam are configured.

### DNS

In your registrar, add CNAME records so that:

- `admin` → target shown in Vercel for admin.techivano.com (e.g. `cname.vercel-dns.com` or the value in Project → Settings → Domains).
- `nrcseam` → same target.

Then in Vercel, use **Verify** for each domain to get SSL.

---

## Supabase Auth redirect URLs

Add the subdomain callback URLs to your Supabase project so OAuth and email links work.

### Option A: Script (Management API)

1. Create a [Personal Access Token](https://supabase.com/dashboard/account/tokens) (PAT).
2. Run (replace `YOUR_PAT` and optional `YOUR_PROJECT_REF`):

```powershell
cd c:\path\to\techivano-eam
$env:SUPABASE_ACCESS_TOKEN="YOUR_PAT"
$env:SUPABASE_PROJECT_REF="itzigdbbkkwmnaitlqfy"   # or leave unset if VITE_SUPABASE_URL is in .env
pnpm tsx scripts/supabase-add-redirect-urls.ts
```

The script GETs the current auth config, merges in:

- `https://admin.techivano.com`
- `https://admin.techivano.com/`
- `https://admin.techivano.com/auth/callback`
- `https://nrcseam.techivano.com`
- `https://nrcseam.techivano.com/`
- `https://nrcseam.techivano.com/auth/callback`

and PATCHes `uri_allow_list` so these are allowed.

### Option B: Dashboard

1. Open [Authentication → URL Configuration](https://supabase.com/dashboard/project/_/auth/url-configuration) for your project.
2. Under **Redirect URLs**, add:
   - `https://admin.techivano.com`
   - `https://admin.techivano.com/auth/callback`
   - `https://nrcseam.techivano.com`
   - `https://nrcseam.techivano.com/auth/callback`
3. Save.

---

## Summary

| Step | Tool | Status |
|------|------|--------|
| Add admin.techivano.com to Vercel project | `vercel domains add admin.techivano.com` | Done |
| Add nrcseam.techivano.com to Vercel project | `vercel domains add nrcseam.techivano.com` | Done |
| Supabase redirect URLs | Script or Dashboard | Done |
| DNS CNAME for admin + nrcseam | Registrar (e.g. Cloudflare) | Add when ready; then Verify in Vercel |

---

## What's left (at your registrar only)

When you want the subdomains live, add the CNAME records using one of these options:

### Option 1: Vercel CLI (if the domain uses Vercel DNS and your account has permission)

From the project directory:

```bash
vercel dns add techivano.com admin CNAME cname.vercel-dns.com
vercel dns add techivano.com nrcseam CNAME cname.vercel-dns.com
```

### Option 2: Your DNS provider (Cloudflare, Namecheap, etc.)

At the registrar or DNS host for **techivano.com**, add:

- CNAME admin → Vercel’s target (often `cname.vercel-dns.com`)
- CNAME nrcseam → Vercel’s target (same)

Get the exact target from **Vercel → Project → Settings → Domains** for each domain if it differs.

### After adding the records

In Vercel, open **Project → Settings → Domains** and click **Verify** for each domain to issue SSL.
