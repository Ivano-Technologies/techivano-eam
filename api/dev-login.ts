import type { IncomingMessage, ServerResponse } from "http";
import { createClient } from "@supabase/supabase-js";
import { COOKIE_NAME, SESSION_COOKIE_NAME } from "../shared/const";
import { ENV } from "../server/_core/env";
import {
  createUserSession,
  getUserByEmail,
  getUserBySupabaseUserId,
  provisionUserFromSupabase,
  setUserSupabaseId,
} from "../server/db";

function json(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function isSecureRequest(req: IncomingMessage): boolean {
  if (process.env.NODE_ENV === "production") return true;
  const raw = req.headers["x-forwarded-proto"];
  const first = (Array.isArray(raw) ? raw[0] : raw)?.split(",")[0]?.trim().toLowerCase();
  return first === "https";
}

function getAuthCookies(req: IncomingMessage, accessToken: string, sessionId?: string): string[] {
  const secure = isSecureRequest(req);
  const suffix = `; Path=/; HttpOnly; SameSite=Lax; Max-Age=${365 * 24 * 60 * 60}${
    secure ? "; Secure" : ""
  }`;
  const cookies = [`${COOKIE_NAME}=${encodeURIComponent(accessToken)}${suffix}`];
  if (sessionId) cookies.push(`${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}${suffix}`);
  return cookies;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Method not allowed" });
  }

  if (process.env.NODE_ENV === "production") {
    return json(res, 404, { error: "Not found" });
  }

  const email = process.env.E2E_AUTH_EMAIL;
  const password = process.env.E2E_AUTH_PASSWORD;
  if (!email || !password) {
    return json(res, 404, { error: "Not configured" });
  }

  try {
    const sb = createClient(ENV.supabaseUrl, ENV.supabaseAnonKey);
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      return json(res, 401, { error: error?.message ?? "No session" });
    }
    const accessToken = data.session.access_token;
    const parts = accessToken.split(".");
    if (parts.length !== 3) {
      return json(res, 401, { error: "Malformed access token" });
    }
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as {
      sub?: string;
      email?: string;
    };
    if (!payload.sub) {
      return json(res, 401, { error: "Token missing sub claim" });
    }

    let user = await getUserBySupabaseUserId(payload.sub);
    if (!user && payload.email) {
      const byEmail = await getUserByEmail(payload.email);
      if (byEmail) {
        const id = (byEmail as Record<string, unknown>).id as number;
        await setUserSupabaseId(id, payload.sub);
        user = (await getUserBySupabaseUserId(payload.sub)) ?? byEmail;
      }
    }
    if (!user) {
      user = (await provisionUserFromSupabase({ sub: payload.sub, email: payload.email })) ?? undefined;
    }
    if (!user) {
      return json(res, 401, { error: "App user not found and could not be provisioned" });
    }

    const supabaseUserId = (user as Record<string, unknown>).supabaseUserId;
    let sessionId: string | undefined;
    if (typeof supabaseUserId === "string") {
      try {
        sessionId = (await createUserSession({
          userId: supabaseUserId,
          userAgent: req.headers["user-agent"],
          ip: (req.socket.remoteAddress ?? "").toString(),
        })) ?? undefined;
      } catch {
        // non-fatal for E2E login
      }
    }

    res.setHeader("Set-Cookie", getAuthCookies(req, accessToken, sessionId));
    return json(res, 200, { success: true });
  } catch (err) {
    return json(res, 500, { error: (err as Error).message });
  }
}
