import postgres from "postgres";
import { config } from "dotenv";
config({ path: ".env.local" }); // optional for local; CI uses env from workflow
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
const sql = postgres(process.env.DATABASE_URL);
const r = await sql`select permissions from organization_members limit 1`;
console.log("OK: permissions column exists, row(s) =", r.length);
await sql.end();
