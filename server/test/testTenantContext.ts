/**
 * Reusable test helper: run test code inside tenant DB context so that
 * getDb() returns a Drizzle instance with app.tenant_id set (RLS).
 * Use for tests that call getDb() directly or need tenant context.
 */
import { runWithTenantDb } from "../db";
import { TEST_ORG_ID } from "./contextHelpers";

/**
 * Run fn inside runWithTenantDb(TEST_ORG_ID). Use when a test needs
 * tenant context (e.g. direct getDb() calls or to ensure RLS applies).
 */
export async function runWithTestTenantContext<T>(fn: () => Promise<T>): Promise<T> {
  return runWithTenantDb(TEST_ORG_ID, fn);
}
