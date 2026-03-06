import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";

export const integrationConnectors = pgTable("integration_connectors", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  provider: varchar("provider", { length: 64 }).notNull(),
  status: varchar("status", { length: 32 }).default("disconnected").notNull(),
  config: jsonb("config").default({}).notNull(),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
