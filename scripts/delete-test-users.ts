/**
 * Delete all non-admin users from the app 'users' table.
 * Keeps every user with role = 'admin'. Use with care: this cannot be undone.
 *
 * Run from project root:
 *   pnpm tsx scripts/delete-test-users.ts
 */
import "dotenv/config";
import { getRootDb } from "../server/db";
import { users } from "../drizzle/schema";
import { eq, inArray, ne } from "drizzle-orm";

async function main() {
  const db = getRootDb();
  if (!db) {
    console.error("Database not available. Set DATABASE_URL in .env");
    process.exit(1);
  }

  const admins = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role })
    .from(users)
    .where(eq(users.role, "admin"));

  const adminIds = admins.map((a) => a.id);
  console.log(`Keeping ${adminIds.length} admin(s):`, admins.map((a) => `${a.email} (id=${a.id})`).join(", ") || "none");

  if (adminIds.length === 0) {
    console.error("No admin accounts found. Aborting to avoid deleting everyone.");
    process.exit(1);
  }

  const toDelete = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(ne(users.role, "admin"));

  const idsToDelete = toDelete.map((r) => r.id);
  if (idsToDelete.length === 0) {
    console.log("No non-admin users to delete.");
    process.exit(0);
  }

  console.log(`Will delete ${idsToDelete.length} non-admin user(s).`);

  // Clear approvedBy so no kept row references a deleted user
  await db
    .update(users)
    .set({ approvedBy: null })
    .where(inArray(users.approvedBy, idsToDelete));
  console.log("Cleared approvedBy references to users that will be deleted.");

  await db.delete(users).where(ne(users.role, "admin"));
  console.log(`Done. Deleted ${idsToDelete.length} user(s). Kept ${adminIds.length} admin(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
