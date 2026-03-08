CREATE TABLE `supply_chain_risk_scores` (
  `id` int AUTO_INCREMENT NOT NULL,
  `tenant_id` int NOT NULL,
  `stock_item_id` int NOT NULL,
  `vendor_id` int NOT NULL,
  `demand_volatility` decimal(6,4) NOT NULL,
  `lead_time_risk` decimal(6,4) NOT NULL,
  `vendor_risk` decimal(6,4) NOT NULL,
  `transport_risk` decimal(6,4) NOT NULL,
  `inventory_pressure` decimal(6,4) NOT NULL,
  `supply_chain_risk_index` decimal(6,4) NOT NULL,
  `risk_band` enum('low','moderate','elevated','high','critical') NOT NULL,
  `agent_execution_id` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `supply_chain_risk_scores_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_supply_chain_risk_scores_tenant` ON `supply_chain_risk_scores` (`tenant_id`);
--> statement-breakpoint
CREATE INDEX `idx_supply_chain_risk_scores_stock_item` ON `supply_chain_risk_scores` (`stock_item_id`);
--> statement-breakpoint
CREATE INDEX `idx_supply_chain_risk_scores_vendor` ON `supply_chain_risk_scores` (`vendor_id`);
--> statement-breakpoint
CREATE INDEX `idx_supply_chain_risk_scores_created_at` ON `supply_chain_risk_scores` (`created_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_supply_chain_risk_scores_execution` ON `supply_chain_risk_scores` (`tenant_id`,`stock_item_id`,`vendor_id`,`agent_execution_id`);
--> statement-breakpoint
CREATE TABLE `supply_chain_risk_events` (
  `id` int AUTO_INCREMENT NOT NULL,
  `tenant_id` int NOT NULL,
  `stock_item_id` int NOT NULL,
  `vendor_id` int NOT NULL,
  `risk_type` varchar(64) NOT NULL,
  `risk_score` decimal(6,4) NOT NULL,
  `risk_band` enum('low','moderate','elevated','high','critical') NOT NULL,
  `description` text,
  `agent_execution_id` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `supply_chain_risk_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_supply_chain_risk_events_tenant` ON `supply_chain_risk_events` (`tenant_id`);
--> statement-breakpoint
CREATE INDEX `idx_supply_chain_risk_events_stock_item` ON `supply_chain_risk_events` (`stock_item_id`);
--> statement-breakpoint
CREATE INDEX `idx_supply_chain_risk_events_vendor` ON `supply_chain_risk_events` (`vendor_id`);
--> statement-breakpoint
CREATE INDEX `idx_supply_chain_risk_events_created_at` ON `supply_chain_risk_events` (`created_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_supply_chain_risk_events_execution` ON `supply_chain_risk_events` (`tenant_id`,`stock_item_id`,`vendor_id`,`risk_type`,`agent_execution_id`);
