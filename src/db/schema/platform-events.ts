import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

export const platformEvents = pgTable("platform_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  eventType: varchar("event_type", { length: 128 }).notNull(),
  eventPayload: jsonb("event_payload").default({}).notNull(),
  processed: boolean("processed").default(false).notNull(),
  processedBy: varchar("processed_by", { length: 128 }),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
