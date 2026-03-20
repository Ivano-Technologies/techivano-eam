import crypto from "crypto";
import * as db from "../db";
import { authTokens } from "../../drizzle/schema";
import { and, eq, gt } from "drizzle-orm";

const MAGIC_LINK_EXPIRY_MINUTES = 15;

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** Create an app magic-link token in authTokens table (short-lived, one-time use). */
export async function createMagicLinkToken(userId: number): Promise<string> {
  const database = db.getRootDb();
  if (!database) throw new Error("Database not available");

  const token = generateToken();
  const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY_MINUTES * 60 * 1000);

  await database.insert(authTokens).values({
    userId,
    token,
    type: "magic_link",
    expiresAt,
  });

  return token;
}

/** Verify and consume app magic-link token; returns user id when valid. */
export async function verifyMagicLinkToken(token: string): Promise<number | null> {
  const database = db.getRootDb();
  if (!database) return null;

  const result = await database
    .select()
    .from(authTokens)
    .where(
      and(
        eq(authTokens.token, token),
        eq(authTokens.type, "magic_link"),
        gt(authTokens.expiresAt, new Date())
      )
    )
    .limit(1);

  if (result.length === 0 || !result[0].userId) return null;
  const authToken = result[0];
  if (authToken.usedAt) return null;

  await database
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(eq(authTokens.id, authToken.id));

  return authToken.userId;
}
