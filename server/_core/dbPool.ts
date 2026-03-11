/**
 * Supabase Postgres connection pool.
 * Tenant context and runWithTenantDb live in server/db.ts (Drizzle transaction API).
 */
import postgres from "postgres";
import { ENV } from "./env";
import { logger } from "./logger";

export type PostgresClient = ReturnType<typeof postgres>;

let sqlClient: PostgresClient | null = null;

/**
 * Get the Postgres client (pool) for non-request-scoped use (e.g. no tenant, or background jobs).
 */
export function getPostgresClient(): PostgresClient | null {
  if (!ENV.databaseUrl) return null;
  if (!sqlClient) {
    try {
      sqlClient = postgres(ENV.databaseUrl, {
        max: 10,
        idle_timeout: 20,
        connect_timeout: 10,
      });
    } catch (error) {
      logger.warn("Postgres pool initialization failed", {
        errorType: error instanceof Error ? error.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
  return sqlClient;
}
