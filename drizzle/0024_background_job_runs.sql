CREATE TABLE IF NOT EXISTS "backgroundJobRuns" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenantId" integer NOT NULL DEFAULT 1,
  "jobName" varchar(100) NOT NULL,
  "queueJobId" varchar(100),
  "status" varchar(20) NOT NULL DEFAULT 'queued',
  "attempts" integer NOT NULL DEFAULT 0,
  "maxAttempts" integer NOT NULL DEFAULT 3,
  "requestedBy" integer,
  "payload" text,
  "result" text,
  "error" text,
  "queuedAt" timestamp NOT NULL DEFAULT now(),
  "startedAt" timestamp NULL,
  "completedAt" timestamp NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_background_job_runs_tenant" ON "backgroundJobRuns" ("tenantId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_background_job_runs_status" ON "backgroundJobRuns" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_background_job_runs_job_name" ON "backgroundJobRuns" ("jobName");
