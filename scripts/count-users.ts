/**
 * Count total users in the app 'users' table.
 * Run: pnpm tsx scripts/count-users.ts
 */
import "dotenv/config";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { getRootDb } from "../server/db";
import { users } from "../drizzle/schema";
import { sql } from "drizzle-orm";

async function main() {
  const db = getRootDb();
  if (!db) {
    console.error("Database not available. Set DATABASE_URL in .env");
    process.exit(1);
  }

  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users);

  const total = row ? Number(row.count) : 0;
  console.log("Total users in database:", total);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
