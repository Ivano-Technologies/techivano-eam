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
import "./index.css";

const AppProviders = lazy(() => import("./providers/AppProviders"));

function AppLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
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

createRoot(document.getElementById("root")!).render(
  <Suspense fallback={<AppLoader />}>
    <AppProviders />
  </Suspense>
);

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
