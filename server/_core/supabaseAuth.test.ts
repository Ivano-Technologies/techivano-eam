/**
 * Phase 8: Unit tests for Supabase JWT verification and user resolution.
 * @see docs/SUPABASE_AUTH_MIGRATION_PLAN.md Phase 8
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";
import {
  looksLikeSupabaseJwt,
  verifySupabaseToken,
  getUserFromSupabaseToken,
} from "./supabaseAuth";

const TEST_SUB = "550e8400-e29b-41d4-a716-446655440000";
const TEST_EMAIL = "test@example.com";

vi.mock("./env", () => ({
  ENV: {
    supabaseJwtSecret: "a".repeat(32),
    supabaseJwtIssuer: undefined,
    supabaseJwtAudience: undefined,
  },
}));

vi.mock("../db", () => ({
  getUserByEmail: vi.fn(),
  getUserBySupabaseUserId: vi.fn(),
  setUserSupabaseId: vi.fn(),
  provisionUserFromSupabase: vi.fn(),
}));

vi.mock("./userCache", () => ({
  getCachedUser: vi.fn(),
  setUserInCache: vi.fn(),
}));

import * as db from "../db";
import * as userCache from "./userCache";

const dbMock = vi.mocked(db);
const userCacheMock = vi.mocked(userCache);

const TEST_SECRET = "a".repeat(32);

async function createValidToken(overrides?: { sub?: string; email?: string; exp?: number }) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    sub: overrides?.sub ?? TEST_SUB,
    email: overrides?.email ?? TEST_EMAIL,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(overrides?.exp ?? now + 3600)
    .sign(new TextEncoder().encode(TEST_SECRET));
}

describe("looksLikeSupabaseJwt", () => {
  it("returns true for a three-part JWT with sub", () => {
    const token = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1dWlkIn0.x";
    expect(looksLikeSupabaseJwt(token)).toBe(true);
  });

  it("returns false for empty or non-string", () => {
    expect(looksLikeSupabaseJwt("")).toBe(false);
    expect(looksLikeSupabaseJwt(null)).toBe(false);
    expect(looksLikeSupabaseJwt(undefined)).toBe(false);
  });

  it("returns false for two-part string", () => {
    expect(looksLikeSupabaseJwt("a.b")).toBe(false);
  });

  it("returns false when payload has no sub", () => {
    const payload = Buffer.from(JSON.stringify({ email: "a@b.com" })).toString("base64url");
    expect(looksLikeSupabaseJwt(`a.${payload}.c`)).toBe(false);
  });
});

describe("verifySupabaseToken", () => {
  it("returns payload for valid token", async () => {
    const token = await createValidToken();
    const payload = await verifySupabaseToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe(TEST_SUB);
    expect(payload?.email).toBe(TEST_EMAIL);
  });

  it("returns null for empty or invalid token", async () => {
    expect(await verifySupabaseToken("")).toBeNull();
    expect(await verifySupabaseToken("invalid")).toBeNull();
    expect(await verifySupabaseToken(null)).toBeNull();
  });

  it("returns null for expired token", async () => {
    const token = await createValidToken({
      exp: Math.floor(Date.now() / 1000) - 3600,
    });
    expect(await verifySupabaseToken(token)).toBeNull();
  });

  it("returns null for malformed token (bad signature)", async () => {
    const valid = await createValidToken();
    const parts = valid.split(".");
    const tampered = `${parts[0]}.${parts[1]}.bad-signature`;
    expect(await verifySupabaseToken(tampered)).toBeNull();
  });

  it("returns null for malformed token (invalid base64 payload)", async () => {
    expect(await verifySupabaseToken("a.!!!.c")).toBeNull();
  });
});

describe("getUserFromSupabaseToken", () => {
  beforeEach(() => {
    dbMock.getUserByEmail.mockReset();
    dbMock.getUserBySupabaseUserId.mockReset();
    dbMock.setUserSupabaseId.mockReset();
    userCacheMock.getCachedUser.mockReset();
    userCacheMock.setUserInCache.mockReset();
  });

  it("returns null for invalid or missing token", async () => {
    expect(await getUserFromSupabaseToken("")).toBeNull();
    expect(await getUserFromSupabaseToken(null)).toBeNull();
    expect(await getUserFromSupabaseToken("bad")).toBeNull();
  });

  it("returns cached user when cache hit", async () => {
    const token = await createValidToken();
    const cachedUser = { id: 1, email: TEST_EMAIL, openId: "oid", name: "Test", role: "user" };
    userCacheMock.getCachedUser.mockResolvedValue(cachedUser as never);

    const user = await getUserFromSupabaseToken(token);
    expect(user).toEqual(cachedUser);
    expect(dbMock.getUserByEmail).not.toHaveBeenCalled();
    expect(dbMock.getUserBySupabaseUserId).not.toHaveBeenCalled();
  });

  it("returns null when token valid but unknown user (no cache, no email match)", async () => {
    const token = await createValidToken();
    userCacheMock.getCachedUser.mockResolvedValue(null as never);
    dbMock.getUserBySupabaseUserId.mockResolvedValue(null as never);
    dbMock.getUserByEmail.mockResolvedValue(null as never);

    const user = await getUserFromSupabaseToken(token);
    expect(user).toBeNull();
  });

  it("matches by email and sets supabase_user_id (lazy migration) when sub not in DB", async () => {
    const token = await createValidToken();
    userCacheMock.getCachedUser.mockResolvedValue(null as never);
    dbMock.getUserBySupabaseUserId.mockResolvedValue(null as never);
    const byEmail = { id: 2, email: TEST_EMAIL, openId: "oid2", name: "User", role: "user" };
    dbMock.getUserByEmail.mockResolvedValue(byEmail as never);
    dbMock.setUserSupabaseId.mockResolvedValue(undefined as never);
    dbMock.getUserBySupabaseUserId.mockResolvedValueOnce(null).mockResolvedValueOnce({
      ...byEmail,
      supabaseUserId: TEST_SUB,
    } as never);

    const user = await getUserFromSupabaseToken(token);
    expect(user).not.toBeNull();
    expect(dbMock.getUserByEmail).toHaveBeenCalledWith(TEST_EMAIL);
    expect(dbMock.setUserSupabaseId).toHaveBeenCalledWith(2, TEST_SUB);
    expect(userCacheMock.setUserInCache).toHaveBeenCalled();
  });
});
