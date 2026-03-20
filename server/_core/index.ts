import "dotenv/config";
import { initSentry } from "./sentry";
import { startServerlessRuntime } from "./serverlessRuntime";
import { getBackgroundQueue } from "../jobs/queue";

initSentry();

if (process.env.NODE_ENV === "development") {
  process.on("unhandledRejection", (reason) => {
    console.error("[dev] Unhandled rejection (server will keep running):", reason);
  });
  const hasCustomGoogle = Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID?.trim());
  console.log(
    "[dev] Custom Google OAuth (continue to EAM):",
    hasCustomGoogle ? "enabled" : "not configured (using Supabase Google)"
  );
}

// Initialize background queue if configured; runtime should still start without Redis.
try {
  getBackgroundQueue();
} catch (error) {
  if (process.env.NODE_ENV === "development") {
    console.warn("[dev] Background queue unavailable:", (error as Error).message);
  } else {
    throw error;
  }
}

const defaultPort = Number(process.env.PORT ?? "3000");
startServerlessRuntime(defaultPort);
