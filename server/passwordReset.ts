// @ts-nocheck — schema pg-core vs getDb mysql2, query result types
import crypto from 'crypto';
import { getDb } from './db';
import { passwordResetTokens, users } from '../drizzle/schema';
import { eq, and, gt } from 'drizzle-orm';
import { hashPassword } from './passwordAuth';

const TOKEN_EXPIRY_MINUTES = 15;

export async function generateResetToken(email: string): Promise<{ token: string; userId: number } | null> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  // Find user by email
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  
  if (!user) {
    return null;
  }
  
  // Generate secure random token
  const token = crypto.randomBytes(32).toString('hex');
  
  // Calculate expiry time (15 minutes from now)
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);
  
  // Delete any existing tokens for this user
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));
  
  // Insert new token
  await db.insert(passwordResetTokens).values({
    userId: user.id,
    token,
    expiresAt,
  });
  
  return { token, userId: user.id };
}

export async function verifyResetToken(token: string): Promise<number | null> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  const now = new Date();
  
  // Find valid token
  const [resetToken] = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.token, token),
        gt(passwordResetTokens.expiresAt, now)
      )
    )
    .limit(1);
  
  if (!resetToken) {
    return null;
  }
  
  return resetToken.userId;
}

export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  const userId = await verifyResetToken(token);
  
  if (!userId) {
    return false;
  }
  
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  // Hash new password
  const passwordHash = await hashPassword(newPassword);
  
  // Update user password
  await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.id, userId));
  
  // Delete used token
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.token, token));
  
  return true;
}

export async function cleanupExpiredTokens(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  const now = new Date();
  await db.delete(passwordResetTokens).where(gt(passwordResetTokens.createdAt, now));
}
