// @ts-nocheck — DB connection, tenant context, org id normalization
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { ENV } from "../_core/env";
import { logger } from "../_core/logger";
import { getPostgresClient } from "../_core/dbPool";
import { AsyncLocalStorage } from "node:async_hooks";

let _db: PostgresJsDatabase | null = null;

/** Request-scoped Drizzle tx when running inside runWithTenantDb (for RLS). */
const tenantDbStorage = new AsyncLocalStorage<{ tx: PostgresJsDatabase }>();

/** Root DB (no tenant context). Use for auth, background jobs, and schema checks. */
export function getRootDb(): PostgresJsDatabase | null {
  if (!_db && ENV.databaseUrl) {
    try {
      const client = getPostgresClient();
      if (client) _db = drizzle(client) as PostgresJsDatabase;
    } catch (error) {
      logger.warn("Database connection initialization failed", {
        errorType: error instanceof Error ? error.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      _db = null;
    }
  }
  return _db;
}

/**
 * Run fn inside a Drizzle transaction with app.tenant_id set for RLS.
 * Use this to wrap tRPC procedures when organizationId is present.
 */
export async function runWithTenantDb<T>(
  organizationId: string,
  fn: () => Promise<T>
): Promise<T> {
  const rootDb = getRootDb();
  if (!rootDb) {
    logger.warn("runWithTenantDb: no DB; running without tenant context");
    return fn();
  }
  return rootDb.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.tenant_id', ${organizationId}, true)`);
    return tenantDbStorage.run({ tx: tx as PostgresJsDatabase }, fn);
  });
}

/** Get current request's Drizzle tx if inside runWithTenantDb. */
export function getTenantDbTx(): PostgresJsDatabase | null {
  const store = tenantDbStorage.getStore();
  return store?.tx ?? null;
}

/**
 * Request-scoped DB with tenant context (RLS). Use inside runWithTenantDb only.
 * Throws if tenant context is missing to prevent accidental non-tenant queries.
 */
export async function getDb(): Promise<PostgresJsDatabase> {
  const tenantTx = getTenantDbTx();
  if (tenantTx) return tenantTx;
  throw new Error(
    "Tenant DB context missing. Use runWithTenantDb() before accessing the database."
  );
}

const UUID_V4_LIKE_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeOrganizationId(input: string | number): string {
  if (typeof input === "string") {
    const trimmed = input.trim().toLowerCase();
    if (UUID_V4_LIKE_PATTERN.test(trimmed)) return trimmed;
    throw new Error("organizationId must be a UUID string or positive numeric tenant id");
  }

  if (!Number.isInteger(input) || input <= 0) {
    throw new Error("organizationId must be a UUID string or positive numeric tenant id");
  }

  const tenantHex = Number(input).toString(16).padStart(12, "0").slice(-12);
  return `00000000-0000-4000-8000-${tenantHex}`;
}
