/**
 * One-time script to grant admin role to a user by email.
 * Use this so an admin can access Pending Users and review registrations.
 *
 * Run from project root:
 *   pnpm tsx scripts/promote-admin.ts <email>
 *
 * Example:
 *   pnpm tsx scripts/promote-admin.ts admin@techivano.com
 */
import "dotenv/config";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { getRootDb } from "../server/db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const email = process.argv[2]?.trim();
if (!email) {
  console.error("Usage: pnpm tsx scripts/promote-admin.ts <email>");
  process.exit(1);
}

async function main() {
  const db = getRootDb();
  if (!db) {
    console.error("Database not available. Set DATABASE_URL in .env");
    process.exit(1);
  }

  const result = await db
    .update(users)
    .set({ role: "admin", status: "approved" })
    .where(eq(users.email, email))
    .returning({ id: users.id, email: users.email, role: users.role });

  if (result.length === 0) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }

  console.log(`Done. User ${email} is now an admin.`);
  console.log("Sign in at /login and open Pending Users from the sidebar to review registrations.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
