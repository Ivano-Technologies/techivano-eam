/**
 * Signed impersonation token: 30min expiry + session binding. Verify on every request when x-impersonation header is present.
 */
import { createHmac } from "node:crypto";
import { ENV } from "./env";

const ALG = "sha256";
const SEP = ".";
const ENC = "base64url";
const EXPIRY_MS = 1000 * 60 * 30; // 30 minutes

export type ImpersonationPayload = {
  impersonatorId: string;
  targetUserId: string;
  exp: number;
  sessionId?: string | null;
};

export type SignImpersonationOptions = {
  impersonatorId: string;
  targetUserId: string;
  sessionId?: string | null;
};

function secret(): string {
  const s = ENV.cookieSecret;
  return s && s.length > 0 ? s : "impersonation-fallback-secret";
}

export function signImpersonationToken(options: SignImpersonationOptions): string {
  const payload = {
    impersonatorId: options.impersonatorId,
    targetUserId: options.targetUserId,
    exp: Date.now() + EXPIRY_MS,
    ...(options.sessionId != null && options.sessionId !== "" && { sessionId: options.sessionId }),
  };
  const payloadJson = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadJson, "utf8").toString(ENC);
  const sig = createHmac(ALG, secret()).update(payloadB64).digest(ENC);
  return `${payloadB64}${SEP}${sig}`;
}

/**
 * Verify token: signature, expiry (30min), and optional session binding.
 * @param currentSessionId - When token has sessionId, it must match (prevents token reuse across devices).
 */
export function verifyImpersonationToken(
  token: string,
  currentSessionId?: string | null
): ImpersonationPayload | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.trim().split(SEP);
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  try {
    const expectedSig = createHmac(ALG, secret()).update(payloadB64).digest(ENC);
    if (expectedSig !== sig) return null;
    const json = Buffer.from(payloadB64, ENC).toString("utf8");
    const parsed = JSON.parse(json) as ImpersonationPayload & { exp?: number; sessionId?: string | null };
    if (
      typeof parsed.impersonatorId !== "string" ||
      typeof parsed.targetUserId !== "string" ||
      !parsed.impersonatorId ||
      !parsed.targetUserId
    ) {
      return null;
    }
    if (typeof parsed.exp === "number" && parsed.exp < Date.now()) {
      return null; // Token expired
    }
    if (parsed.sessionId != null && parsed.sessionId !== "") {
      if (currentSessionId !== parsed.sessionId) {
        return null; // Session binding mismatch
      }
    }
    return {
      impersonatorId: parsed.impersonatorId,
      targetUserId: parsed.targetUserId,
      exp: typeof parsed.exp === "number" ? parsed.exp : Date.now() + EXPIRY_MS,
      sessionId: parsed.sessionId,
    };
  } catch {
    return null;
  }
}
