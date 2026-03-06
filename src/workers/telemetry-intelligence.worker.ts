import { Worker } from "bullmq";
import { createAdminClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  telemetryAggregatePayloadSchema,
  telemetryDetectAnomaliesPayloadSchema,
} from "@/lib/jobs/telemetry-jobs";
import {
  telemetryAggregate,
  telemetryDetectAnomalies,
} from "@/lib/telemetry/anomaly-detection";
import { publishEvent } from "@/modules/events/event-bus";

const TELEMETRY_QUEUE = "telemetry-intelligence";
const JOB_AGGREGATE = "telemetry.aggregate";
const JOB_DETECT = "telemetry.detectAnomalies";

const redisUrl = requiredEnv("REDIS_URL");
const supabase = createAdminClient();

const worker = new Worker(
  TELEMETRY_QUEUE,
  async (job) => {
    if (job.name === JOB_AGGREGATE) {
      const payload = telemetryAggregatePayloadSchema.parse(job.data);
      const aggregates = telemetryAggregate(payload.points);
      await publishEvent(supabase, "telemetry.aggregate.completed", {
        tenantId: payload.tenantId,
        count: aggregates.length,
      });
      return;
    }
    if (job.name === JOB_DETECT) {
      const payload = telemetryDetectAnomaliesPayloadSchema.parse(job.data);
      const anomalies = telemetryDetectAnomalies(
        payload.points,
        payload.baseline,
        payload.thresholdRatio,
      );
      if (anomalies.length > 0) {
        const { error } = await supabase.from("telemetry_anomaly_events").insert(
          anomalies.map((row) => ({
            tenant_id: payload.tenantId,
            asset_id: row.assetId,
            signal_name: row.signalName,
            signal_value: row.signalValue,
            baseline_value: row.baselineValue,
            anomaly_score: row.anomalyScore,
            severity: row.severity,
            event_payload: row,
          })),
        );
        if (error) {
          throw new Error(`Persist anomalies failed: ${error.message}`);
        }
      }
      await publishEvent(supabase, "telemetry.anomaly.detected", {
        tenantId: payload.tenantId,
        count: anomalies.length,
      });
    }
  },
  {
    connection: { url: redisUrl },
    concurrency: 2,
  },
);

worker.on("ready", () => {
  logger.info("Telemetry intelligence worker started", {
    operation: "worker.telemetry.start",
  });
});

worker.on("failed", (job, error) => {
  logger.error("Telemetry intelligence worker failed", {
    operation: "worker.telemetry.failed",
    jobId: job?.id,
    error: error.message,
  });
});

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} for telemetry worker`);
  return value;
}
