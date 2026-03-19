import { createRemoteJWKSet, jwtVerify } from "jose";
import { createClerkClient } from "@clerk/backend";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";
import { getCachedUser, setUserInCache } from "./userCache";

type ClerkTokenPayload = {
  sub: string;
  iss: string;
  email?: string;
};

const jwksByIssuer = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwksForIssuer(issuer: string): ReturnType<typeof createRemoteJWKSet> {
  const normalized = issuer.replace(/\/$/, "");
  const existing = jwksByIssuer.get(normalized);
  if (existing) return existing;
  const jwks = createRemoteJWKSet(new URL(`${normalized}/.well-known/jwks.json`));
  jwksByIssuer.set(normalized, jwks);
  return jwks;
}

function decodePayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractPayload(jwtPayload: Record<string, unknown>): ClerkTokenPayload | null {
  const sub = jwtPayload.sub;
  const iss = jwtPayload.iss;
  if (typeof sub !== "string" || !sub) return null;
  if (typeof iss !== "string" || !iss) return null;
  const email = typeof jwtPayload.email === "string" ? jwtPayload.email : undefined;
  return { sub, iss, email };
}

async function fetchClerkEmail(clerkUserId: string): Promise<string | undefined> {
  if (!ENV.clerkSecretKey) return undefined;
  try {
    const clerk = createClerkClient({ secretKey: ENV.clerkSecretKey });
    const user = await clerk.users.getUser(clerkUserId);
    const primaryEmailId = user.primaryEmailAddressId ?? null;
    const primary = user.emailAddresses.find((e) => e.id === primaryEmailId) ?? user.emailAddresses[0];
    return primary?.emailAddress;
  } catch {
    return undefined;
  }
}

export async function verifyClerkToken(token: string | undefined | null): Promise<ClerkTokenPayload | null> {
  if (!token?.trim()) return null;
  const decoded = decodePayload(token);
  if (!decoded) return null;
  const extracted = extractPayload(decoded);
  if (!extracted) return null;
  try {
    const jwks = getJwksForIssuer(extracted.iss);
    const { payload } = await jwtVerify(token, jwks, {
      issuer: extracted.iss,
      clockTolerance: 10,
    });
    return extractPayload(payload as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function getUserFromClerkToken(token: string | undefined | null): Promise<User | null> {
  const payload = await verifyClerkToken(token);
  if (!payload?.sub) return null;

  const cached = await getCachedUser(payload.sub);
  if (cached) return cached as User;

  const byOpenId = await db.getUserByOpenId(payload.sub);
  if (byOpenId) {
    await setUserInCache(payload.sub, byOpenId as User);
    return byOpenId as User;
  }

  const email = payload.email ?? (await fetchClerkEmail(payload.sub));
  if (email) {
    const byEmail = await db.getUserByEmail(email);
    if (byEmail) {
      await setUserInCache(payload.sub, byEmail as User);
      return byEmail as User;
    }
  }

  const provisioned = await db.provisionUserFromSupabase({ sub: payload.sub, email });
  if (provisioned) {
    const user = provisioned as User;
    await setUserInCache(payload.sub, user);
    return user;
  }
  return null;
}

export function looksLikeClerkJwt(token: string | undefined | null): boolean {
  const payload = token ? decodePayload(token) : null;
  return Boolean(payload && typeof payload.sub === "string" && typeof payload.iss === "string");
}

