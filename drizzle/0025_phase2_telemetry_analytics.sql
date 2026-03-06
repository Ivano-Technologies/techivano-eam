CREATE TABLE `telemetry_points` (
  `id` int AUTO_INCREMENT NOT NULL,
  `tenantId` int NOT NULL,
  `assetId` int NOT NULL,
  `timestamp` timestamp NOT NULL,
  `metric` varchar(64) NOT NULL,
  `value` decimal(15,4) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `telemetry_points_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_telemetry_points_tenant_asset_metric_ts` ON `telemetry_points` (`tenantId`,`assetId`,`metric`,`timestamp`);
--> statement-breakpoint
CREATE TABLE `telemetry_aggregates` (
  `id` int AUTO_INCREMENT NOT NULL,
  `tenantId` int NOT NULL,
  `assetId` int NOT NULL,
  `metric` varchar(64) NOT NULL,
  `hour_bucket` timestamp NOT NULL,
  `avg_value` decimal(15,4) NOT NULL,
  `max_value` decimal(15,4) NOT NULL,
  `min_value` decimal(15,4) NOT NULL,
  `count` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `telemetry_aggregates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_telemetry_aggregates_bucket` ON `telemetry_aggregates` (`tenantId`,`assetId`,`metric`,`hour_bucket`);
--> statement-breakpoint
CREATE INDEX `idx_telemetry_aggregates_tenant_metric_hour` ON `telemetry_aggregates` (`tenantId`,`metric`,`hour_bucket`);
--> statement-breakpoint
CREATE TABLE `report_snapshots` (
  `id` int AUTO_INCREMENT NOT NULL,
  `tenantId` int NOT NULL,
  `report_type` varchar(100) NOT NULL,
  `generated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `payload_json` text NOT NULL,
  CONSTRAINT `report_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_report_snapshots_tenant_type_generated` ON `report_snapshots` (`tenantId`,`report_type`,`generated_at`);
--> statement-breakpoint
CREATE TABLE `predictive_scores` (
  `id` int AUTO_INCREMENT NOT NULL,
  `tenantId` int NOT NULL,
  `assetId` int NOT NULL,
  `riskScore` int NOT NULL,
  `factors_json` text,
  `scored_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `predictive_scores_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_predictive_scores_tenant_asset_scored` ON `predictive_scores` (`tenantId`,`assetId`,`scored_at`);
