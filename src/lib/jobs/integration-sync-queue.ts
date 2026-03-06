import { Queue } from "bullmq";
import { z } from "zod";

export const INTEGRATION_SYNC_QUEUE = "integration-sync";
export const INTEGRATION_SYNC_JOB = "integration.sync";

export const IntegrationSyncPayloadSchema = z.object({
  tenantId: z.string().uuid(),
  provider: z.enum(["SAP", "Oracle", "QuickBooks", "ArcGIS"]),
});

export type IntegrationSyncPayload = z.infer<typeof IntegrationSyncPayloadSchema>;

let queue: Queue<IntegrationSyncPayload> | null = null;

function getQueue() {
  if (queue) return queue;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("Missing REDIS_URL for integration sync queue");
  queue = new Queue<IntegrationSyncPayload>(INTEGRATION_SYNC_QUEUE, {
    connection: { url: redisUrl },
  });
  return queue;
}

export async function enqueueIntegrationSync(payload: IntegrationSyncPayload) {
  const parsed = IntegrationSyncPayloadSchema.parse(payload);
  await getQueue().add(INTEGRATION_SYNC_JOB, parsed, {
    jobId: `${parsed.tenantId}:${parsed.provider}:${Date.now()}`,
    attempts: 3,
    backoff: { type: "exponential", delay: 500 },
    removeOnComplete: 200,
    removeOnFail: 500,
  });
}
