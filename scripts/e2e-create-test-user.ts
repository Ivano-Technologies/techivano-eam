/**
 * Creates an approved E2E test user and prints credentials for Playwright.
 * Run from project root (with DB and env available):
 *
 *   pnpm tsx scripts/e2e-create-test-user.ts
 *
 * Optional: ALLOWED_SIGNUP_DOMAINS=example.com (or use default gmail.com and pass email below).
 * Output: set E2E_AUTH_EMAIL and E2E_AUTH_PASSWORD then run:
 *   E2E_BASE_URL=http://localhost:3000 E2E_AUTH_EMAIL=... E2E_AUTH_PASSWORD=... pnpm test:e2e:auth
 */
import "dotenv/config";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import { getRootDb } from "../server/db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { createUserWithPassword } from "../server/passwordAuth";

const EMAIL = process.env.E2E_CREATE_EMAIL ?? `e2e-${Date.now()}@example.com`;
const PASSWORD = process.env.E2E_CREATE_PASSWORD ?? "e2e-test-password-8";

async function main() {
  const db = getRootDb();
  if (!db) {
    console.error("Database not available. Set DATABASE_URL in .env");
    process.exit(1);
  }

  const existing = await db.select().from(users).where(eq(users.email, EMAIL)).limit(1);
  if (existing.length > 0) {
    const u = existing[0];
    if (u.status === "approved") {
      console.log("E2E test user already exists and is approved. Use E2E_AUTH_EMAIL and the password you set for this user:");
      console.log(`  E2E_AUTH_EMAIL=${EMAIL}`);
      return;
    }
    await db
      .update(users)
      .set({ status: "approved", approvedAt: new Date() })
      .where(eq(users.id, u.id));
    console.log("Existing e2e user approved. Use:");
    console.log(`  E2E_AUTH_EMAIL=${EMAIL}`);
    console.log(`  E2E_AUTH_PASSWORD=${process.env.E2E_CREATE_PASSWORD ?? PASSWORD}`);
    return;
  }

  const user = await createUserWithPassword(EMAIL, "E2E Test User", PASSWORD);
  if (!user) {
    console.error("Failed to create user");
    process.exit(1);
  }

  const [approver] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.status, "approved"))
    .limit(1);
  const approvedBy = approver?.id ?? null;

  await db
    .update(users)
    .set({
      status: "approved",
      approvedBy,
      approvedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  console.log("E2E test user created and approved. Run Playwright with:");
  console.log(`  E2E_AUTH_EMAIL=${EMAIL}`);
  console.log(`  E2E_AUTH_PASSWORD=${PASSWORD}`);
  console.log("Example:");
  console.log(`  E2E_BASE_URL=http://localhost:3000 E2E_AUTH_EMAIL=${EMAIL} E2E_AUTH_PASSWORD=${PASSWORD} pnpm test:e2e:auth`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
