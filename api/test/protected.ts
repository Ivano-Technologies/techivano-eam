import type { IncomingMessage, ServerResponse } from "http";
import { parse as parseCookie } from "cookie";
import { COOKIE_NAME } from "../../shared/const";
import { verifySupabaseToken } from "../../server/_core/supabaseAuth";

function json(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (process.env.NODE_ENV !== "test") {
    return json(res, 404, { error: "Not found" });
  }
  const authHeader = req.headers.authorization;
  const bearer =
    typeof authHeader === "string" && authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : "";
  const cookies = parseCookie(req.headers.cookie ?? "");
  const token = bearer || cookies[COOKIE_NAME] || "";
  const payload = await verifySupabaseToken(token);
  if (!payload) return json(res, 401, { success: false, error: "Unauthorized" });
  return json(res, 200, { success: true, sub: payload.sub });
}
