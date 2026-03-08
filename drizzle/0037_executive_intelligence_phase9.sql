CREATE TABLE `executive_metrics_snapshots` (
  `id` int AUTO_INCREMENT NOT NULL,
  `tenant_id` int NOT NULL,
  `snapshot_date` timestamp NOT NULL,
  `asset_health_index` decimal(6,4) NOT NULL,
  `maintenance_cost_projection` decimal(6,4) NOT NULL,
  `inventory_pressure_index` decimal(6,4) NOT NULL,
  `vendor_risk_index` decimal(6,4) NOT NULL,
  `supply_chain_risk_index` decimal(6,4) NOT NULL,
  `fleet_utilization_rate` decimal(6,4) NOT NULL,
  `technician_productivity_score` decimal(6,4) NOT NULL,
  `overall_operations_index` decimal(8,2) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `agent_execution_id` varchar(100) NOT NULL,
  CONSTRAINT `executive_metrics_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_executive_metrics_snapshots_tenant` ON `executive_metrics_snapshots` (`tenant_id`);
--> statement-breakpoint
CREATE INDEX `idx_executive_metrics_snapshots_snapshot_date` ON `executive_metrics_snapshots` (`snapshot_date`);
--> statement-breakpoint
CREATE INDEX `idx_executive_metrics_snapshots_created_at` ON `executive_metrics_snapshots` (`created_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_executive_metrics_snapshots_execution` ON `executive_metrics_snapshots` (`tenant_id`,`snapshot_date`,`agent_execution_id`);
--> statement-breakpoint
CREATE TABLE `operational_kpi_trends` (
  `id` int AUTO_INCREMENT NOT NULL,
  `tenant_id` int NOT NULL,
  `metric_name` varchar(100) NOT NULL,
  `metric_value` decimal(8,4) NOT NULL,
  `metric_date` timestamp NOT NULL,
  `trend_direction` enum('up','down','stable') NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `agent_execution_id` varchar(100) NOT NULL,
  CONSTRAINT `operational_kpi_trends_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_operational_kpi_trends_tenant` ON `operational_kpi_trends` (`tenant_id`);
--> statement-breakpoint
CREATE INDEX `idx_operational_kpi_trends_metric_name` ON `operational_kpi_trends` (`metric_name`);
--> statement-breakpoint
CREATE INDEX `idx_operational_kpi_trends_metric_date` ON `operational_kpi_trends` (`metric_date`);
--> statement-breakpoint
CREATE INDEX `idx_operational_kpi_trends_created_at` ON `operational_kpi_trends` (`created_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_operational_kpi_trends_execution` ON `operational_kpi_trends` (`tenant_id`,`metric_name`,`metric_date`,`agent_execution_id`);
