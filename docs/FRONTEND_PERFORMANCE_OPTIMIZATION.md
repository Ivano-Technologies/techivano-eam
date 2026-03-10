# Techivano Frontend Performance Optimization

**Last updated:** 2026-03-09  
**Stack:** React, Vite, Supabase, Tailwind, TypeScript

---

## 1. Bundle Analysis Summary

### Before optimization (baseline)

- **Main bundle:** ~1.53 MB single JS chunk (`index-*.js`)
- **Total JS:** Single large entry; no route-level code splitting
- **Issues:** Oversized main chunk, no manual chunks for heavy deps, analytics script placeholders in HTML

### After optimization (latest)

| Metric | Target | Current | Notes |
|--------|--------|---------|--------|
| Main bundle | < 300 KB | **~364 KB** | Down from 426 KB via lazy provider shell; initial entry is minimal (Sentry, analytics, root, Suspense) |
| Provider shell | — | **64 KB** (AppProviders) | tRPC + React Query + App; loaded immediately after main |
| Largest chunk | < 200 KB | **334 KB** (html5-qrcode) | Lazy-loaded only on Scanner pages; not on initial load |
| Initial JS (main + providers + vendor + trpc + layout) | < 500 KB | **~590 KB** | Main 364 + AppProviders 64 + vendor 30 + trpc 90 + radix 108 + layout 114 (some parallel) |
| CSS | < 100 KB | **~157 KB** | Tailwind v4; optional: audit unused utilities |
| PWA precache | — | **13 entries, ~3.2 MB** | No longer precaches all JS; `/assets/*.js` use StaleWhileRevalidate |
| Total JS (all chunks) | — | **~3.5 MB** (uncompressed) | Many lazy route chunks; only required chunks load per route |

### Top contributors to bundle size (by chunk)

1. **index (main shell):** 426 KB — App, router, providers, Sentry, tRPC client setup
2. **html5-qrcode:** 334 KB — Loaded only on Asset Scanner / Smart Scanner pages
3. **AssetDetail:** 174 KB — Asset detail page
4. **DashboardLayout:** 114 KB — Sidebar, nav, layout (lazy-loaded)
5. **radix-ui:** 108 KB — Dialog, dropdown, tabs, select, popover, label
6. **trpc-query:** 90 KB — tRPC client, React Query
7. **Assets (page):** 86 KB — Assets list page
8. **sonner:** 33 KB — Toasts
9. **vendor (react, react-dom):** 30 KB

---

## 2. Implemented Optimizations

### 2.1 Lazy provider shell

- **`client/src/providers/AppProviders.tsx`** — Contains tRPC client, QueryClient, cache subscribers, and `<App />`. Loaded via `React.lazy()` from `main.tsx`.
- **`main.tsx`** — Only loads: Sentry init, analytics snippet, `createRoot`, `Suspense`, lazy `AppProviders`, and a small `AppLoader` fallback. No trpc/react-query/superjson in the main chunk.
- **Result:** Main bundle reduced from ~426 KB to **~364 KB**; first paint depends on a smaller entry before the provider chunk loads.

### 2.2 Code splitting (Vite)

- **Manual chunks** in `vite.config.ts` for:
  - `vendor`: react, react-dom
  - `supabase`: @supabase/supabase-js
  - `charts`: recharts
  - `trpc-query`: @trpc/client, @trpc/react-query, @tanstack/react-query
  - `superjson`, `wouter`, `sonner`, `next-themes`
  - `form-libs`: react-hook-form, @hookform/resolvers, zod
  - `radix-ui`: dialog, dropdown, tabs, tooltip, select, popover, label
  - `framer-motion`, `lucide-react`, `date-fns`, `html5-qrcode`
- **Route-level lazy loading:** All page components and `DashboardLayout` use `React.lazy()`; wrapped in `Suspense` with a spinner fallback.
- **Result:** Main chunk reduced from 1.53 MB to ~426 KB; heavy features (scanner, dashboards, reports) load on demand.

### 2.2 Build configuration

- **target:** `esnext` — modern browsers, smaller output
- **minify:** `esbuild` — fast and effective minification
- **sourcemap:** `false` — smaller deploy size (enable for debugging when needed)
- **chunkSizeWarningLimit:** `300` — warns when a chunk exceeds 300 KB (e.g. html5-qrcode on scanner route)

### 2.3 Analytics and HTML

- Removed static script with `%VITE_ANALYTICS_*%` placeholders from `index.html`.
- Analytics (Umami) loaded only when `VITE_ANALYTICS_ENDPOINT` and `VITE_ANALYTICS_WEBSITE_ID` are set, via a small script in `main.tsx`. No build-time env warnings.

### 2.4 Supabase client

- Single instance in `client/src/lib/supabase.ts`; imported where needed. No duplicate initialization.

### 2.5 Tailwind CSS

- Tailwind v4 with `@tailwindcss/vite`; JIT and content scanning are handled by the Vite plugin. No separate `tailwind.config.ts` content/purge config required.

### 2.6 Fonts and static assets

- Google Fonts use `display=swap` in the URL to avoid blocking render.
- Preconnect to `fonts.googleapis.com` and `fonts.gstatic.com` for faster font loading.

### 2.7 React rendering

- **React.memo** applied to list-heavy pages: `Assets`, `WorkOrders`, `Home` to avoid unnecessary re-renders when parent or context updates.

### 2.8 Admin / heavy features

- Bulk import, analytics dashboards, report scheduling, and scanner pages are lazy-loaded via route-level `React.lazy()`. They do not contribute to initial bundle.

### 2.9 Service worker (Workbox)

- **Precache** limited to CSS, HTML, icons, images, manifest, `registerSW.js` — **no `**/*.js`** so large JS chunks are not precached.
- **Runtime caching:** `/api/*` → NetworkFirst; `/assets/*.js` → StaleWhileRevalidate (7-day cache); images → CacheFirst.
- Precache size dropped from ~98 entries to **13 entries** (~3.2 MB vs ~5.5 MB).

### 2.10 Route prefetching

- **Home (dashboard)** runs `import("@/pages/Assets")` and `import("@/pages/WorkOrders")` in a `useEffect` so those chunks are fetched in the background. Navigation to Assets or Work Orders is faster when the chunk is already cached.

### 2.11 Web Vitals

- **`web-vitals`** package reports LCP, CLS, and INP (dynamic import from main so it doesn’t bloat the entry). In dev, metrics are logged; you can plug in `sendToAnalytics(metric)` for production.

---

## 3. Bundle analyzer

To generate a visual bundle report:

```bash
pnpm run build:analyze
```

Opens (or outputs) `dist/public/stats.html` with an interactive treemap (when `ANALYZE=true`). Use it to spot large dependencies and duplicate code.

---

## 4. Verification

```bash
pnpm install
pnpm build
```

- Build completes with no errors.
- Warning “Some chunks are larger than 300 kB” is expected for the **html5-qrcode** chunk (scanner-only, lazy-loaded).
- Main chunk `index-*.js` is ~426 KB (gzip ~125 KB).

---

## 5. Remaining opportunities

| Opportunity | Impact | Effort |
|-------------|--------|--------|
| Reduce main chunk to < 300 KB | Smaller first load | Medium — lazy-load ThemeProvider/contexts or split more of the shell |
| Replace or lazy-load html5-qrcode | Smaller scanner route | High — alternative lib or dynamic import inside scanner page |
| CSS audit (Tailwind) | Possibly smaller CSS | Low — remove unused utilities or split critical CSS |
| More aggressive memo (e.g. table rows) | Fewer re-renders on list pages | Low |
| Service worker / PWA precache tuning | Less precache size | Low — adjust `globPatterns` or exclude large chunks from precache |

---

## 6. Files modified

| File | Change |
|------|--------|
| `vite.config.ts` | `target`, `minify`, `sourcemap`, `chunkSizeWarningLimit`, expanded `manualChunks`, optional visualizer; Workbox: narrow precache, `StaleWhileRevalidate` for `/assets/*.js` |
| `client/src/main.tsx` | Lazy `AppProviders`, minimal shell (Sentry, analytics, root, Suspense), Web Vitals dynamic import |
| `client/src/providers/AppProviders.tsx` | **New** — tRPC + React Query + App (lazy-loaded) |
| `client/src/App.tsx` | Lazy-loaded routes and `DashboardLayout`, `Suspense` + fallback |
| `client/src/pages/Home.tsx` | `memo()`; prefetch Assets + WorkOrders chunks on mount |
| `client/src/pages/Assets.tsx` | Wrapped in `memo()` |
| `client/src/pages/WorkOrders.tsx` | Wrapped in `memo()` |
| `client/index.html` | Removed analytics script; font comment |
| `package.json` | `build:analyze` script; `web-vitals` dependency |
| `docs/FRONTEND_PERFORMANCE_OPTIMIZATION.md` | This document |

---

## 7. Target metrics vs actual

| Metric | Target | Actual |
|--------|--------|--------|
| Main bundle | < 300 KB | **~364 KB** (down from 426 KB after lazy providers) |
| Largest chunk | < 200 KB | 334 KB (lazy scanner only) |
| Total JS (initial) | < 500 KB | **~590 KB** (main + AppProviders + vendor + trpc + radix + layout) |
| CSS | < 100 KB | ~157 KB |
| PWA precache | Avoid all JS | 13 entries, no full JS precache; assets use StaleWhileRevalidate |
| Build | No errors | ✓ |

The main bundle is still above 300 KB; going lower would require splitting theme/Sentry or more of the shell. The original 1.53 MB single bundle is now a small entry (~364 KB) plus an on-demand provider chunk (~64 KB) and route-level splitting.
