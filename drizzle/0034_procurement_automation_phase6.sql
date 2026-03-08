CREATE TABLE `procurement_recommendations` (
  `id` int AUTO_INCREMENT NOT NULL,
  `tenant_id` int NOT NULL,
  `stock_item_id` int NOT NULL,
  `recommended_vendor_id` int NOT NULL,
  `recommended_quantity` int NOT NULL,
  `demand_score` decimal(6,4) NOT NULL,
  `vendor_risk_score` decimal(6,4) NOT NULL,
  `procurement_priority` enum('monitor','prepare_procurement','reorder','immediate_procurement') NOT NULL,
  `agent_execution_id` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `procurement_recommendations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_procurement_recos_tenant` ON `procurement_recommendations` (`tenant_id`);
--> statement-breakpoint
CREATE INDEX `idx_procurement_recos_stock_item` ON `procurement_recommendations` (`stock_item_id`);
--> statement-breakpoint
CREATE INDEX `idx_procurement_recos_created_at` ON `procurement_recommendations` (`created_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_procurement_recos_execution` ON `procurement_recommendations` (`tenant_id`,`stock_item_id`,`recommended_vendor_id`,`agent_execution_id`);
--> statement-breakpoint
CREATE TABLE `purchase_orders` (
  `id` int AUTO_INCREMENT NOT NULL,
  `tenant_id` int NOT NULL,
  `vendor_id` int NOT NULL,
  `status` enum('draft','submitted','approved','rejected','closed') NOT NULL DEFAULT 'draft',
  `total_value` decimal(15,2) NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `purchase_orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_purchase_orders_tenant` ON `purchase_orders` (`tenant_id`);
--> statement-breakpoint
CREATE INDEX `idx_purchase_orders_vendor` ON `purchase_orders` (`vendor_id`);
--> statement-breakpoint
CREATE INDEX `idx_purchase_orders_created_at` ON `purchase_orders` (`created_at`);
