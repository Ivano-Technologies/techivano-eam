import type { IncomingMessage, ServerResponse } from "http";
import { DEV_BYPASS_COOKIE_NAME } from "../shared/const";
import { getDevAdminUser } from "../server/db";

function json(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function getHost(req: IncomingMessage): string {
  const raw =
    (req.headers["x-forwarded-host"] as string) ||
    (Array.isArray(req.headers.host) ? req.headers.host[0] : req.headers.host) ||
    "";
  return raw.toLowerCase();
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Method not allowed" });
  }
  if (process.env.NODE_ENV !== "development") {
    return json(res, 403, { error: "Dev admin login only available in development" });
  }

  const host = getHost(req);
  const isLocal = /^localhost(:\d+)?$/i.test(host) || /^127\.0\.0\.1(:\d+)?$/i.test(host);
  if (!isLocal) {
    return json(res, 403, { error: "Dev admin login only allowed from localhost" });
  }

  const devAdmin = await getDevAdminUser(process.env.DEV_ADMIN_EMAIL ?? null);
  if (!devAdmin) {
    return json(res, 503, {
      error: "No dev admin user found. Set DEV_ADMIN_EMAIL or ensure at least one user has role admin.",
    });
  }

  const secure =
    (process.env.NODE_ENV as string) === "production" ||
    String(req.headers["x-forwarded-proto"] ?? "").toLowerCase().includes("https");

  const cookie = `${DEV_BYPASS_COOKIE_NAME}=${encodeURIComponent(
    String((devAdmin as { id: number }).id)
  )}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${24 * 60 * 60}${secure ? "; Secure" : ""}`;
  res.setHeader("Set-Cookie", cookie);
  return json(res, 200, { success: true });
}
