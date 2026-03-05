CREATE TABLE `backgroundJobRuns` (
  `id` int AUTO_INCREMENT NOT NULL,
  `tenantId` int NOT NULL DEFAULT 1,
  `jobName` varchar(100) NOT NULL,
  `queueJobId` varchar(100),
  `status` enum('queued','running','completed','failed','dead') NOT NULL DEFAULT 'queued',
  `attempts` int NOT NULL DEFAULT 0,
  `maxAttempts` int NOT NULL DEFAULT 3,
  `requestedBy` int,
  `payload` text,
  `result` text,
  `error` text,
  `queuedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `startedAt` timestamp NULL,
  `completedAt` timestamp NULL,
  CONSTRAINT `backgroundJobRuns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_background_job_runs_tenant` ON `backgroundJobRuns` (`tenantId`);
--> statement-breakpoint
CREATE INDEX `idx_background_job_runs_status` ON `backgroundJobRuns` (`status`);
--> statement-breakpoint
CREATE INDEX `idx_background_job_runs_job_name` ON `backgroundJobRuns` (`jobName`);
