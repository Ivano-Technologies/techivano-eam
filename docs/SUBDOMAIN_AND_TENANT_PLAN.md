# Techivano EAM — Subdomain & Tenant Plan

This document outlines the concrete setup for techivano.com as the parent site, with subdomains for tenants and a future migration path for NRCS.

---

## 1. Target structure (summary)

| Host | Purpose | Who can sign in | When |
|------|---------|------------------|------|
| **techivano.com** | Marketing (landing, product info, links to app) | — | Current |
| **admin.techivano.com** | Mothership — Ivano Technologies internal EAM | **Only** @ivanotechnologies.com | **Create now** |
| **nrcseam.techivano.com** | NRCS tenant (client instance) | NRCS-allowed domains | **After** web app testing |
| **eam.redcrossnigeria.org** or **redcrossnigeria.org/eam** | NRCS EAM on their domain | Same as NRCS tenant | **Later** (migration) |

---

## 2. Phase 1 — admin.techivano.com (mothership) — do now

**Goal:** Ivano staff use admin.techivano.com with @ivanotechnologies.com accounts only; techivano.com remains marketing.

### 2.1 DNS

- Add **admin** as a subdomain of techivano.com:
  - **admin.techivano.com** → same target as current app (e.g. Vercel project or your app host).
- If the app is on Vercel: add `admin.techivano.com` to the project’s domains in Vercel Dashboard (Domain → Add).

### 2.2 App / auth behaviour

- **Subdomain resolution:** When host is `admin.techivano.com`, the app resolves tenant to “Ivano” (mothership) and applies:
  - Allowed login/signup domains: **ivanotechnologies.com** only (and optionally no public signup).
- **Branding:** Use Techivano / Ivano Technologies branding (logo, name) on admin.techivano.com.
- **techivano.com (apex):** Serves marketing only (static site or separate app). No EAM login on apex unless you add a tenant selector later.

### 2.3 Checklist

- [ ] DNS: Create **admin.techivano.com** and point to app host.
- [ ] Hosting: Add **admin.techivano.com** to app’s allowed domains (e.g. Vercel).
- [ ] App config: Map host `admin.techivano.com` → Ivano tenant + restrict auth to @ivanotechnologies.com.
- [ ] Branding: Ensure mothership UI uses Techivano/Ivano branding on this subdomain.
- [ ] SSL: Ensure certificate covers admin.techivano.com (automatic with Vercel/custom host).

---

## 3. Phase 2 — nrcseam.techivano.com — after testing

**Goal:** NRCS tenant on its own subdomain after the web app is tested and stable.

### 3.1 Prerequisites

- Web app tested and signed off.
- NRCS tenant and allowed domains already configured in the app (current behaviour can stay as-is for one tenant).

### 3.2 DNS & hosting

- Add **nrcs** subdomain:
  - **nrcseam.techivano.com** → same app as admin.techivano.com (multi-tenant by host).
- Add **nrcseam.techivano.com** to the app’s domains (e.g. Vercel).

### 3.3 App behaviour

- When host is **nrcseam.techivano.com**, resolve tenant to NRCS organization:
  - Use existing NRCS allowed domains and NRCS branding (logo, name).
- Optional: Redirect or link from techivano.com marketing to **nrcseam.techivano.com** for “NRCS EAM” access.

### 3.4 Checklist

- [ ] Testing: Web app tested and approved.
- [ ] DNS: Create **nrcseam.techivano.com** and point to app host.
- [ ] Hosting: Add **nrcseam.techivano.com** to app domains.
- [ ] App config: Map host `nrcseam.techivano.com` → NRCS tenant + existing NRCS auth and branding.
- [ ] Marketing: Update techivano.com to link to nrcseam.techivano.com for NRCS EAM.

---

## 4. Phase 3 — NRCS migration to Red Cross Nigeria domain (later)

**Goal:** Move NRCS EAM to their official domain when agreed: either **eam.redcrossnigeria.org** or **redcrossnigeria.org/eam**.

### 4.1 Option A — eam.redcrossnigeria.org (subdomain)

- NRCS (or their IT) creates **eam** subdomain on redcrossnigeria.org (e.g. eam.redcrossnigeria.org).
- Point **eam.redcrossnigeria.org** to the same app (CNAME to your app host, or via their hosting).
- App: Add **eam.redcrossnigeria.org** as an allowed domain; map this host to the **same** NRCS tenant (no data migration).
- After cutover: Optional redirect **nrcseam.techivano.com** → **eam.redcrossnigeria.org** for NRCS users.

### 4.2 Option B — redcrossnigeria.org/eam (path)

- NRCS hosts the app at a path (e.g. redcrossnigeria.org/eam) via reverse proxy or their hosting.
- App may need to run under a base path (e.g. `/eam`) or be reverse-proxied so that the app still sees a stable host/origin for tenant resolution and cookies.
- Map that origin/path to the same NRCS tenant in your config.

### 4.3 Checklist (when you execute migration)

- [ ] Agree with NRCS: subdomain (eam.redcrossnigeria.org) vs path (redcrossnigeria.org/eam).
- [ ] DNS/hosting: NRCS points chosen host to your app (or proxy).
- [ ] App: Add new host (and base path if needed) and map to existing NRCS tenant.
- [ ] Auth/session: Ensure cookies and redirect URLs work on new domain/path.
- [ ] Optional: Redirect nrcseam.techivano.com → new NRCS URL and update marketing links.

---

## 5. techivano.com (apex) — marketing only

- **techivano.com** = marketing site (product, links, “Log in” → send users to the right place).
- “Log in” can:
  - Link to **admin.techivano.com** (Ivano staff), and  
  - Link to **nrcseam.techivano.com** (or later eam.redcrossnigeria.org / redcrossnigeria.org/eam) for NRCS.
- No EAM app logic or tenant on the apex unless you later add a tenant selector there.

---

## 6. Order of operations (recap)

1. **Now:** Set up **admin.techivano.com** (DNS + app + Ivano-only auth), keep techivano.com as marketing.
2. **After testing:** Set up **nrcseam.techivano.com** (DNS + app tenant mapping + NRCS branding).
3. **Later:** Plan and execute NRCS migration to **eam.redcrossnigeria.org** or **redcrossnigeria.org/eam** using the same NRCS tenant and app.

---

## 7. Implementation notes (for dev)

- **Tenant resolution:** Use `Host` header (e.g. `admin.techivano.com` → Ivano, `nrcseam.techivano.com` → NRCS). Store mapping in config or DB (host → organization_id / tenant id).
- **Allowed domains per tenant:** In config or tenant settings, restrict signup/login by email domain (e.g. Ivano tenant: `["ivanotechnologies.com"]`; NRCS: existing list).
- **Branding:** Per-tenant config for name, logo, and theme; select by resolved tenant.
- **Cookies:** Set cookie scope per host (e.g. `admin.techivano.com`) so sessions don’t leak across tenants.

This plan keeps techivano.com as marketing, creates the mothership (admin.techivano.com) now, adds nrcseam.techivano.com after testing, and leaves a clear path to migrate NRCS to their own domain later.
