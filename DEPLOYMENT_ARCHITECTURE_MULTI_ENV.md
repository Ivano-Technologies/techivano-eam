# Techivano Multi-Environment Deployment Architecture

Last updated: 2026-03-09

## Scope

This document defines and verifies the two-environment deployment model for Techivano SaaS:

- Production: `techivano.com`
- Staging: `staging.techivano.com`

## Access Verification (Phase 1)

- Cloudflare: API token is valid and active; DNS read/edit + zone read permissions confirmed.
- Vercel: CLI authenticated (`kezi3`) and team/project access confirmed.
- GitHub: `gh` authenticated; repository remote is `Ivano-Technologies/techivano-eam`.
- Supabase: MCP access confirmed; project `TECHIVANO EAM` is accessible.
- Railway: CLI authenticated (`Kezie` account).

## Vercel Audit (Phase 2)

Project:

- Name: `techivano-eam`
- Team: `techivano` (Ivano Technologies)
- Framework preset: `Vite`
- Build command: `pnpm build`
- Output directory: `dist/public`
- Install command: `pnpm install --frozen-lockfile`
- Git integration: GitHub repo `Ivano-Technologies/techivano-eam`
- Production branch: `main`

Domain state:

- `techivano.com` -> attached to `techivano-eam` (redirects to `www.techivano.com`)
- `www.techivano.com` -> attached to `techivano-eam`
- `staging.techivano.com` -> attached to `techivano-eam` with `gitBranch=staging`

## DNS Records (Phase 3)

Before changes, no explicit `staging.techivano.com` record existed.

Created:

- `CNAME` `staging.techivano.com` -> `cname.vercel-dns.com` (`proxied=true`)

Relevant current records:

- `A` `techivano.com` -> `216.150.16.129` (`proxied=true`)
- `A` `techivano.com` -> `216.150.1.129` (`proxied=true`)
- `A` `www.techivano.com` -> `216.150.1.193` (`proxied=true`)
- `A` `www.techivano.com` -> `216.150.16.193` (`proxied=true`)
- `A` `*.techivano.com` -> `216.150.1.65` (`proxied=true`)
- `A` `*.techivano.com` -> `216.150.16.1` (`proxied=true`)
- `CNAME` `staging.techivano.com` -> `cname.vercel-dns.com` (`proxied=true`)

## Branch Strategy (Phase 5)

Configured rules:

- `main` -> Vercel production deployment -> `techivano.com` / `www.techivano.com`
- `staging` -> Vercel preview deployment -> `staging.techivano.com`

Branch created and pushed:

- `staging` (tracks `origin/staging`)

## Environment Variables (Phase 6)

Verified Vercel env keys and target environments:

- `NEXT_PUBLIC_SUPABASE_URL` -> production, preview, development
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` -> production, preview, development
- `SUPABASE_SERVICE_ROLE_KEY` -> production, preview, development
- `DATABASE_URL` -> production, preview, development

Notes:

- Production values were not modified.
- Preview currently uses the same secret set as production.
- If strict environment isolation is required, create dedicated staging Supabase/Railway resources and update preview-targeted vars accordingly.

## Routing, SSL, and Deployment Flow (Phases 7-8)

Checks performed:

- `techivano.com` returns `307` to `https://www.techivano.com/` and then `200`.
- `www.techivano.com` returns `200` with `x-vercel-id`.
- `staging.techivano.com` currently returns `401` with `x-vercel-id` after successful staging deployment.

Staging deployment simulation:

- Empty commit pushed to `staging` branch.
- New Vercel preview deployment built successfully.
- Alias verified:
  - `techivano-...vercel.app` -> `techivano-eam-git-staging-techivano.vercel.app`
  - `techivano-...vercel.app` -> `staging.techivano.com`

Interpretation:

- Routing is correct and isolated from production.
- Production remained on its existing production deployment.
- `401` on staging indicates Vercel preview access protection is active for that endpoint.

## Security and Performance Checks (Phase 9)

Verified:

- HTTPS is active for production and staging domains.
- No redirect loop detected.
- Vercel cache observed on production (`X-Vercel-Cache: HIT`).

Blocked by token scope:

- Cloudflare zone settings reads (SSL mode, always-use-https, cache/security level) returned `403 Forbidden`.
- DNS operations succeeded, but security/settings audit needs broader Cloudflare token permissions.

## Final Architecture (Phase 10)

Production:

Users  
-> Cloudflare CDN/DNS  
-> Vercel Production Deployment (`main`)  
-> Techivano Application  
-> Supabase + Railway Workers

Staging:

Developers  
-> Cloudflare CDN/DNS  
-> Vercel Preview Deployment (`staging`)  
-> Techivano Staging Endpoint

## Remaining Actions

1. Allow unauthenticated staging access (if required) by adjusting Vercel preview protection policy for `staging.techivano.com`.
2. Provide a Cloudflare token that includes zone settings read permissions to complete Phase 9 settings audit.
3. (Optional) Isolate preview/staging secrets to dedicated staging Supabase and Railway resources.
