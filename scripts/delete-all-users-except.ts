/**
 * Delete all users except one kept by email (e.g. your real admin).
 * Use this to remove test admins (e.g. admin_*@test.com) and leave only the real account.
 * Use with care: this cannot be undone.
 *
 * Run from project root:
 *   pnpm tsx scripts/delete-all-users-except.ts <email>
 *
 * Example (keep only ivanonigeria@gmail.com):
 *   pnpm tsx scripts/delete-all-users-except.ts ivanonigeria@gmail.com
 */
import "dotenv/config";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { getRootDb } from "../server/db";
import { users } from "../drizzle/schema";
import { eq, inArray, ne } from "drizzle-orm";

const KEEP_EMAIL = process.argv[2]?.trim();
if (!KEEP_EMAIL) {
  console.error("Usage: pnpm tsx scripts/delete-all-users-except.ts <email>");
  process.exit(1);
}

async function main() {
  const db = getRootDb();
  if (!db) {
    console.error("Database not available. Set DATABASE_URL in .env");
    process.exit(1);
  }

  const [keepUser] = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role })
    .from(users)
    .where(eq(users.email, KEEP_EMAIL))
    .limit(1);

  if (!keepUser) {
    console.error(`No user found with email: ${KEEP_EMAIL}. Aborting.`);
    process.exit(1);
  }

  const keepId = keepUser.id;
  console.log(`Keeping: ${keepUser.email} (id=${keepId}, role=${keepUser.role})`);

  const all = await db.select({ id: users.id, email: users.email }).from(users);
  const idsToDelete = all.map((r) => r.id).filter((id) => id !== keepId);

  if (idsToDelete.length === 0) {
    console.log("No other users to delete.");
    process.exit(0);
  }

  console.log(`Will delete ${idsToDelete.length} user(s) (including any test admins).`);

  await db
    .update(users)
    .set({ approvedBy: null })
    .where(inArray(users.approvedBy, idsToDelete));

  await db.delete(users).where(ne(users.id, keepId));
  console.log(`Done. Deleted ${idsToDelete.length} user(s). Only ${KEEP_EMAIL} remains.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
