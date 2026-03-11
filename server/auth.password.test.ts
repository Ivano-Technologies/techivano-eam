import { describe, it, expect, beforeAll } from 'vitest';
import { createUserWithPassword, authenticateWithPassword, hashPassword, verifyPassword } from './passwordAuth';
import { getRootDb } from './db';
import { users } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

describe('Password Authentication', () => {
  const testEmail = `test-${Date.now()}@example.com`;
  const testName = 'Test User';
  const testPassword = 'password123';

  beforeAll(async () => {
    // Clean up any existing test user
    const db = getRootDb();
    if (db) {
      await db.delete(users).where(eq(users.email, testEmail));
    }
  });

  it('should hash and verify passwords correctly', async () => {
    const hash = await hashPassword(testPassword);
    expect(hash).toBeTruthy();
    expect(hash).not.toBe(testPassword);

    const isValid = await verifyPassword(testPassword, hash);
    expect(isValid).toBe(true);

    const isInvalid = await verifyPassword('wrongpassword', hash);
    expect(isInvalid).toBe(false);
  });

  it('should create user with password', async () => {
    const user = await createUserWithPassword(testEmail, testName, testPassword);
    
    expect(user).toBeTruthy();
    expect(user.email).toBe(testEmail);
    expect(user.name).toBe(testName);
    expect(user.passwordHash).toBeTruthy();
    expect(user.loginMethod).toBe('password');
    expect(user.openId).toMatch(/^pwd_/);
  });

  it('should authenticate with correct password', async () => {
    const user = await authenticateWithPassword(testEmail, testPassword);
    
    expect(user).toBeTruthy();
    expect(user?.email).toBe(testEmail);
  });

  it('should reject incorrect password', async () => {
    const user = await authenticateWithPassword(testEmail, 'wrongpassword');
    
    expect(user).toBeNull();
  });

  it('should reject non-existent user', async () => {
    const user = await authenticateWithPassword('nonexistent@example.com', testPassword);
    
    expect(user).toBeNull();
  });
});
