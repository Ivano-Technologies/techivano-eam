import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { users, passwordResetTokens } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import type { TrpcContext } from "./_core/context";

function createContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as any,
    res: {
      cookie: () => {},
      clearCookie: () => {},
    } as any,
  };
}

describe("Password Reset Flow", () => {
  const testEmail = `reset-test-${Date.now()}@example.com`;
  const testPassword = "initial123";
  const newPassword = "newpass123";
  let resetToken: string;

  beforeAll(async () => {
    // Create test user with password
    const caller = appRouter.createCaller(createContext());
    await caller.auth.signupWithPassword({
      email: testEmail,
      name: "Reset Test User",
      password: testPassword,
    });
    const db = await getDb();
    if (db) {
      await db.update(users).set({ status: "approved" }).where(eq(users.email, testEmail));
    }
  });

  it("should generate reset token for existing email", async () => {
    const caller = appRouter.createCaller(createContext());
    const result = await caller.auth.requestPasswordReset({ email: testEmail });
    
    expect(result.success).toBe(true);
    expect(result.message).toContain("If an account exists");

    // Verify token was created in database
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    const [user] = await db.select().from(users).where(eq(users.email, testEmail)).limit(1);
    const [token] = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id)).limit(1);
    
    expect(token).toBeDefined();
    expect(token.token).toBeTruthy();
    expect(token.expiresAt).toBeInstanceOf(Date);
    
    resetToken = token.token;
  });

  it("should not reveal if email doesn't exist", async () => {
    const caller = appRouter.createCaller(createContext());
    const result = await caller.auth.requestPasswordReset({ email: "nonexistent@example.com" });
    
    // Should return same message for security
    expect(result.success).toBe(true);
    expect(result.message).toContain("If an account exists");
  });

  it("should reset password with valid token", async () => {
    const caller = appRouter.createCaller(createContext());
    const result = await caller.auth.resetPassword({
      token: resetToken,
      newPassword,
    });
    
    expect(result.success).toBe(true);
    expect(result.message).toContain("Password reset successfully");

    // Verify token was deleted
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    const [token] = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.token, resetToken)).limit(1);
    expect(token).toBeUndefined();
  });

  it("should login with new password", async () => {
    const caller = appRouter.createCaller(createContext());
    
    const result = await caller.auth.loginWithPassword({
      email: testEmail,
      password: newPassword,
    });
    
    expect(result.success).toBe(true);
    expect(result.user.email).toBe(testEmail);
  });

  it("should reject invalid token", async () => {
    const caller = appRouter.createCaller(createContext());
    
    await expect(
      caller.auth.resetPassword({
        token: "invalid-token-12345",
        newPassword: "newpass123",
      })
    ).rejects.toThrow("Invalid or expired reset token");
  });

  it("should reject password shorter than 6 characters", async () => {
    const caller = appRouter.createCaller(createContext());
    
    await expect(
      caller.auth.resetPassword({
        token: "any-token",
        newPassword: "short",
      })
    ).rejects.toThrow();
  });
});
