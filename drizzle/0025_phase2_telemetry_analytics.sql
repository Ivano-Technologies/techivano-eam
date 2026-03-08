CREATE TABLE IF NOT EXISTS "telemetry_points" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenantId" integer NOT NULL,
  "assetId" integer NOT NULL,
  "timestamp" timestamp NOT NULL,
  "metric" varchar(64) NOT NULL,
  "value" numeric(15,4) NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_telemetry_points_tenant_asset_metric_ts" ON "telemetry_points" ("tenantId","assetId","metric","timestamp");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "telemetry_aggregates" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenantId" integer NOT NULL,
  "assetId" integer NOT NULL,
  "metric" varchar(64) NOT NULL,
  "hour_bucket" timestamp NOT NULL,
  "avg_value" numeric(15,4) NOT NULL,
  "max_value" numeric(15,4) NOT NULL,
  "min_value" numeric(15,4) NOT NULL,
  "count" integer NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_telemetry_aggregates_bucket" ON "telemetry_aggregates" ("tenantId","assetId","metric","hour_bucket");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_telemetry_aggregates_tenant_metric_hour" ON "telemetry_aggregates" ("tenantId","metric","hour_bucket");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "report_snapshots" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenantId" integer NOT NULL,
  "report_type" varchar(100) NOT NULL,
  "generated_at" timestamp NOT NULL DEFAULT now(),
  "payload_json" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_report_snapshots_tenant_type_generated" ON "report_snapshots" ("tenantId","report_type","generated_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "predictive_scores" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenantId" integer NOT NULL,
  "assetId" integer NOT NULL,
  "riskScore" integer NOT NULL,
  "factors_json" text,
  "scored_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_predictive_scores_tenant_asset_scored" ON "predictive_scores" ("tenantId","assetId","scored_at");
