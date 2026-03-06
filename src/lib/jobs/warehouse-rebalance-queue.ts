import { Queue } from "bullmq";
import { z } from "zod";

export const WAREHOUSE_REBALANCE_QUEUE = "warehouse-rebalance";
export const WAREHOUSE_REBALANCE_JOB = "warehouse.rebalanceStock";

const WarehouseSignalSchema = z.object({
  warehouseId: z.string().min(1),
  productId: z.string().uuid().optional().nullable(),
  availableUnits: z.number().int(),
  targetUnits: z.number().int(),
});

export const WarehouseRebalancePayloadSchema = z.object({
  tenantId: z.string().uuid(),
  signals: z.array(WarehouseSignalSchema).min(1),
});

export type WarehouseRebalancePayload = z.infer<typeof WarehouseRebalancePayloadSchema>;

let queue: Queue<WarehouseRebalancePayload> | null = null;

function getQueue() {
  if (queue) return queue;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error("Missing REDIS_URL for warehouse rebalance queue");
  }
  queue = new Queue<WarehouseRebalancePayload>(WAREHOUSE_REBALANCE_QUEUE, {
    connection: { url: redisUrl },
  });
  return queue;
}

export async function enqueueWarehouseRebalanceJob(
  payload: WarehouseRebalancePayload,
): Promise<void> {
  const parsed = WarehouseRebalancePayloadSchema.parse(payload);
  await getQueue().add(WAREHOUSE_REBALANCE_JOB, parsed, {
    jobId: `${parsed.tenantId}:${Date.now()}`,
    removeOnComplete: 200,
    removeOnFail: 500,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 500,
    },
  });
}
