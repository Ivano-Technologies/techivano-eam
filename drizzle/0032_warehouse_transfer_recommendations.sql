CREATE TABLE `warehouse_transfer_recommendations` (
  `id` int AUTO_INCREMENT NOT NULL,
  `tenant_id` int NOT NULL,
  `stock_item_id` int NOT NULL,
  `source_warehouse_id` int NOT NULL,
  `target_warehouse_id` int NOT NULL,
  `transfer_quantity` int NOT NULL,
  `transfer_priority` enum('balanced','moderate','urgent','critical') NOT NULL,
  `pressure_score` decimal(6,4) NOT NULL,
  `agent_execution_id` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `warehouse_transfer_recommendations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_warehouse_transfer_recos_tenant` ON `warehouse_transfer_recommendations` (`tenant_id`);
--> statement-breakpoint
CREATE INDEX `idx_warehouse_transfer_recos_stock_item` ON `warehouse_transfer_recommendations` (`stock_item_id`);
--> statement-breakpoint
CREATE INDEX `idx_warehouse_transfer_recos_created_at` ON `warehouse_transfer_recommendations` (`created_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_warehouse_transfer_recos_execution` ON `warehouse_transfer_recommendations` (`tenant_id`,`stock_item_id`,`source_warehouse_id`,`target_warehouse_id`,`agent_execution_id`);
