import type { IncomingMessage, ServerResponse } from "http";
import { verifyMagicLinkAndCreateSupabaseLink } from "../../server/_core/magicLinkVerificationService";

type JsonBody = Record<string, unknown> | null;

function getOrigin(req: IncomingMessage): string | null {
  const host =
    (req.headers["x-forwarded-host"] as string) ||
    (Array.isArray(req.headers.host) ? req.headers.host[0] : req.headers.host) ||
    "";
  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  if (!host) return null;
  return `${proto === "https" ? "https" : "http"}://${host}`;
}

async function readJsonBody(req: IncomingMessage): Promise<JsonBody> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  if (chunks.length === 0) return null;
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function json(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { success: false, message: "Method not allowed" });
  }

  try {
    const origin = getOrigin(req);
    const url = new URL(req.url ?? "/", origin ?? "http://localhost");
    const body = await readJsonBody(req);
    const tokenFromBody = typeof body?.token === "string" ? body.token : "";
    const tokenFromQuery = url.searchParams.get("token") ?? "";
    const token = tokenFromBody || tokenFromQuery;

    // Single-source auth policy: convert legacy app token into Supabase-managed session link only.
    const result = await verifyMagicLinkAndCreateSupabaseLink(token, origin);
    if (!result.success) {
      return json(res, 400, result);
    }

    return json(res, 200, result);
  } catch {
    return json(res, 500, { success: false, message: "Verification failed" });
  }
}
