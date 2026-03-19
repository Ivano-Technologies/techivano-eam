// Initialize Sentry first for error tracking (keep in main chunk — small)
import { initSentry } from "@/lib/sentry";
initSentry();

// Load Umami analytics only when env vars are set (no build-time placeholders)
const analyticsEndpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT;
const analyticsWebsiteId = import.meta.env.VITE_ANALYTICS_WEBSITE_ID;
if (
  typeof analyticsEndpoint === "string" &&
  analyticsEndpoint.length > 0 &&
  typeof analyticsWebsiteId === "string" &&
  analyticsWebsiteId.length > 0
) {
  const script = document.createElement("script");
  script.defer = true;
  script.src = `${analyticsEndpoint.replace(/\/$/, "")}/umami`;
  script.setAttribute("data-website-id", analyticsWebsiteId);
  document.head.appendChild(script);
}

import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import "./index.css";
import { env } from "@/lib/env";

const AppProviders = lazy(() => import("./providers/AppProviders"));

function AppLoader() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100 text-slate-700">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
      <span className="text-sm font-medium">Loading…</span>
    </div>
  );
}

/** Shown when Clerk publishable key is missing at build/runtime — avoids a blank page from ClerkProvider throwing. */
function ClerkConfigError() {
  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10 text-slate-800">
      <div className="mx-auto max-w-lg rounded-lg border border-amber-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-amber-900">Authentication configuration missing</h1>
        <p className="mt-2 text-sm text-slate-600">
          The app needs a Clerk <strong>publishable</strong> key to load. Without{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">VITE_CLERK_PUBLISHABLE_KEY</code>, the sign-in
          experience cannot start.
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>
            <strong>Local:</strong> set <code className="rounded bg-slate-100 px-1 text-xs">VITE_CLERK_PUBLISHABLE_KEY</code>{" "}
            in <code className="rounded bg-slate-100 px-1 text-xs">.env.local</code> and restart the dev server.
          </li>
          <li>
            <strong>Production (e.g. Vercel):</strong> add the same variable to project Environment Variables, then
            redeploy.
          </li>
          <li>
            Get keys from{" "}
            <a
              className="text-red-600 underline decoration-red-600/30 underline-offset-2 hover:text-red-700"
              href="https://dashboard.clerk.com/last-active?path=api-keys"
              target="_blank"
              rel="noreferrer"
            >
              Clerk Dashboard → API keys
            </a>
            .
          </li>
        </ul>
      </div>
    </div>
  );
}

// Register service worker for offline support
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => console.log("Service Worker registered:", reg.scope))
      .catch((err) => console.log("Service Worker registration failed:", err));
  });
}

const rootEl = document.getElementById("root");
if (!rootEl) {
  document.body.innerHTML = "<div style='min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f1f5f9;color:#475569;font-family:system-ui,sans-serif'><div style='text-align:center'><p style='margin:0 0 0.5rem'>Root element missing</p><p style='margin:0;font-size:0.875rem'>Expected &lt;div id=\"root\"&gt; in index.html</p></div></div>";
} else {
  if (import.meta.env.DEV && typeof globalThis !== "undefined" && !(globalThis as unknown as { __vite_plugin_react_preamble_installed__?: boolean }).__vite_plugin_react_preamble_installed__) {
    console.warn("⚠️ React preamble missing — app may fail to hydrate");
  }
  const clerkPublishableKey = env.CLERK_PUBLISHABLE_KEY.trim();
  if (!clerkPublishableKey) {
    console.error(
      "[auth] Missing VITE_CLERK_PUBLISHABLE_KEY — set it in .env.local (dev) or Vercel env (prod), then rebuild."
    );
    createRoot(rootEl).render(<ClerkConfigError />);
  } else {
    createRoot(rootEl).render(
      <Suspense fallback={<AppLoader />}>
        <ClerkProvider
          publishableKey={clerkPublishableKey}
          signInFallbackRedirectUrl="/"
          signUpFallbackRedirectUrl="/"
        >
          <AppProviders />
        </ClerkProvider>
      </Suspense>
    );
  }
}

// Report Web Vitals (LCP, CLS, INP) — e.g. to analytics or console
import("web-vitals").then(({ onCLS, onINP, onLCP }) => {
  const report = (metric: { name: string; value: number; delta: number }) => {
    if (import.meta.env.DEV) console.log(`[vitals] ${metric.name}:`, metric.value);
    // Optional: send to analytics — e.g. sendToAnalytics(metric)
  };
  onCLS(report);
  onINP(report);
  onLCP(report);
});
