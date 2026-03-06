import {
  pgTable,
  uuid,
  varchar,
  numeric,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";

export const telemetryAnomalyEvents = pgTable("telemetry_anomaly_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  assetId: varchar("asset_id", { length: 128 }).notNull(),
  signalName: varchar("signal_name", { length: 128 }).notNull(),
  signalValue: numeric("signal_value", { precision: 14, scale: 4 }).notNull(),
  baselineValue: numeric("baseline_value", { precision: 14, scale: 4 }),
  anomalyScore: numeric("anomaly_score", { precision: 8, scale: 4 })
    .default("0")
    .notNull(),
  severity: varchar("severity", { length: 32 }).default("medium").notNull(),
  eventPayload: jsonb("event_payload").default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
