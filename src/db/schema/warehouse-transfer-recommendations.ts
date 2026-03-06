import {
  pgTable,
  uuid,
  varchar,
  integer,
  numeric,
  text,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";

export const warehouseTransferRecommendations = pgTable(
  "warehouse_transfer_recommendations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull(),
    fromWarehouseId: varchar("from_warehouse_id", { length: 128 }).notNull(),
    toWarehouseId: varchar("to_warehouse_id", { length: 128 }).notNull(),
    productId: uuid("product_id"),
    quantity: integer("quantity").default(0).notNull(),
    confidence: numeric("confidence", { precision: 5, scale: 2 })
      .default("0")
      .notNull(),
    reason: text("reason"),
    status: varchar("status", { length: 32 }).default("pending").notNull(),
    metadata: jsonb("metadata").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
);
