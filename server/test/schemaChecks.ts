/**
 * Test helpers that check database schema (e.g. table/column existence).
 * Use these to skip tests explicitly when the DB is baseline-only, instead of
 * catching "does not exist" errors (which can mask real failures).
 */
import { sql } from "drizzle-orm";
import { getRootDb } from "../db";

/**
 * Returns true if a table exists in public schema (case-insensitive name match).
 * Uses getRootDb() so this works in tests without tenant context.
 */
export async function tableExists(name: string): Promise<boolean> {
  const db = getRootDb();
  if (!db) return false;
  const result = await db.execute(
    sql`SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND LOWER(table_name) = LOWER(${name}) LIMIT 1`
  );
  const rows = Array.isArray(result) ? result : (result as { rows?: unknown[] })?.rows ?? [];
  return rows.length > 0;
}

/**
 * Returns true if a column exists on a table in public schema.
 */
export async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  const db = getRootDb();
  if (!db) return false;
  const result = await db.execute(
    sql`SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND LOWER(table_name) = LOWER(${tableName}) AND LOWER(column_name) = LOWER(${columnName}) LIMIT 1`
  );
  const rows = Array.isArray(result) ? result : (result as { rows?: unknown[] })?.rows ?? [];
  return rows.length > 0;
}
