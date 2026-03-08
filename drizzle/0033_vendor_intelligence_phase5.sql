CREATE TABLE `vendor_performance_metrics` (
  `id` int AUTO_INCREMENT NOT NULL,
  `tenant_id` int NOT NULL,
  `vendor_id` int NOT NULL,
  `delivery_reliability` decimal(6,4) NOT NULL,
  `cost_variance` decimal(6,4) NOT NULL,
  `lead_time_stability` decimal(6,4) NOT NULL,
  `defect_rate` decimal(6,4) NOT NULL,
  `vendor_score` decimal(6,4) NOT NULL,
  `agent_execution_id` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `vendor_performance_metrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_vendor_perf_metrics_tenant` ON `vendor_performance_metrics` (`tenant_id`);
--> statement-breakpoint
CREATE INDEX `idx_vendor_perf_metrics_vendor` ON `vendor_performance_metrics` (`vendor_id`);
--> statement-breakpoint
CREATE INDEX `idx_vendor_perf_metrics_created_at` ON `vendor_performance_metrics` (`created_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_vendor_perf_metrics_execution` ON `vendor_performance_metrics` (`tenant_id`,`vendor_id`,`agent_execution_id`);
--> statement-breakpoint
CREATE TABLE `vendor_risk_scores` (
  `id` int AUTO_INCREMENT NOT NULL,
  `tenant_id` int NOT NULL,
  `vendor_id` int NOT NULL,
  `vendor_score` decimal(6,4) NOT NULL,
  `risk_score` decimal(6,4) NOT NULL,
  `risk_band` enum('low','medium','high') NOT NULL,
  `agent_execution_id` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `vendor_risk_scores_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_vendor_risk_scores_tenant` ON `vendor_risk_scores` (`tenant_id`);
--> statement-breakpoint
CREATE INDEX `idx_vendor_risk_scores_vendor` ON `vendor_risk_scores` (`vendor_id`);
--> statement-breakpoint
CREATE INDEX `idx_vendor_risk_scores_created_at` ON `vendor_risk_scores` (`created_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_vendor_risk_scores_execution` ON `vendor_risk_scores` (`tenant_id`,`vendor_id`,`agent_execution_id`);
