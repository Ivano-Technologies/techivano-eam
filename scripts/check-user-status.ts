/**
 * One-off script to check registration status of a user by email.
 * Run: pnpm tsx scripts/check-user-status.ts <email>
 */
import "dotenv/config";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { getRootDb } from "../server/db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const email = process.argv[2]?.trim();
if (!email) {
  console.error("Usage: pnpm tsx scripts/check-user-status.ts <email>");
  process.exit(1);
}

async function main() {
  const db = getRootDb();
  if (!db) {
    console.error("Database not available. Set DATABASE_URL in .env");
    process.exit(1);
  }

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      status: users.status,
      role: users.role,
      loginMethod: users.loginMethod,
      approvedBy: users.approvedBy,
      approvedAt: users.approvedAt,
      createdAt: users.createdAt,
      supabaseUserId: users.supabaseUserId,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (rows.length === 0) {
    console.log(`No user found with email: ${email}`);
    console.log("(Not present in app 'users' table.)");
    process.exit(0);
  }

  const u = rows[0];
  console.log("User (from app 'users' table):");
  console.log(JSON.stringify({
    id: u.id,
    email: u.email,
    name: u.name,
    status: u.status,
    role: u.role,
    loginMethod: u.loginMethod,
    approvedBy: u.approvedBy,
    approvedAt: u.approvedAt ? new Date(u.approvedAt).toISOString() : null,
    createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : null,
    supabaseUserId: u.supabaseUserId ?? null,
  }, null, 2));
  console.log("\nRegistration status:", u.status);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
