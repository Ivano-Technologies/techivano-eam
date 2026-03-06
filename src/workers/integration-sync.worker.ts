import { Worker } from "bullmq";
import { createAdminClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  INTEGRATION_SYNC_JOB,
  INTEGRATION_SYNC_QUEUE,
  IntegrationSyncPayloadSchema,
} from "@/lib/jobs/integration-sync-queue";
import { runIntegrationSync } from "@/lib/services/enterprise-integrations";

const redisUrl = requiredEnv("REDIS_URL");
const supabase = createAdminClient();

const worker = new Worker(
  INTEGRATION_SYNC_QUEUE,
  async (job) => {
    if (job.name !== INTEGRATION_SYNC_JOB) return;
    const payload = IntegrationSyncPayloadSchema.parse(job.data);
    await runIntegrationSync(supabase, {
      tenantId: payload.tenantId,
      provider: payload.provider,
    });
  },
  {
    connection: { url: redisUrl },
    concurrency: 2,
  },
);

worker.on("ready", () => {
  logger.info("Integration sync worker started", {
    operation: "worker.integration.start",
  });
});

worker.on("failed", (job, error) => {
  logger.error("Integration sync worker failed", {
    operation: "worker.integration.failed",
    jobId: job?.id,
    error: error.message,
  });
});

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}
