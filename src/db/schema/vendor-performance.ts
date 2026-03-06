import {
  pgTable,
  uuid,
  varchar,
  numeric,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";

export const vendorPerformance = pgTable("vendor_performance", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  vendorId: uuid("vendor_id"),
  vendorName: varchar("vendor_name", { length: 255 }).notNull(),
  onTimeDeliveryRate: numeric("on_time_delivery_rate", { precision: 5, scale: 2 })
    .default("0")
    .notNull(),
  qualityScore: numeric("quality_score", { precision: 5, scale: 2 })
    .default("0")
    .notNull(),
  averageLeadTimeDays: numeric("average_lead_time_days", {
    precision: 8,
    scale: 2,
  })
    .default("0")
    .notNull(),
  riskScore: numeric("risk_score", { precision: 5, scale: 2 }).default("0").notNull(),
  recommendation: jsonb("recommendation").default({}).notNull(),
  evaluatedAt: timestamp("evaluated_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
