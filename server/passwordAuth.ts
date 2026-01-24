import bcrypt from 'bcrypt';
import { getDb } from './db';
import { users } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createUserWithPassword(email: string, name: string, password: string) {
  const passwordHash = await hashPassword(password);
  
  // Generate a unique openId for password-based users
  const openId = `pwd_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  await db.insert(users).values({
    openId,
    email,
    name,
    passwordHash,
    loginMethod: 'password',
    role: 'user',
  });
  
  // Fetch the newly created user
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return user;
}

export async function authenticateWithPassword(email: string, password: string) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  
  if (!user || !user.passwordHash) {
    return null;
  }
  
  const isValid = await verifyPassword(password, user.passwordHash);
  
  if (!isValid) {
    return null;
  }
  
  return user;
}
