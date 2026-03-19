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
  createRoot(rootEl).render(
    <Suspense fallback={<AppLoader />}>
      <ClerkProvider
        publishableKey={env.CLERK_PUBLISHABLE_KEY}
        signInFallbackRedirectUrl="/"
        signUpFallbackRedirectUrl="/"
      >
        <AppProviders />
      </ClerkProvider>
    </Suspense>
  );
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
