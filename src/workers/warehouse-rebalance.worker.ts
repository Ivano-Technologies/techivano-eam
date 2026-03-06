import { Worker } from "bullmq";
import { createAdminClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  WAREHOUSE_REBALANCE_JOB,
  WAREHOUSE_REBALANCE_QUEUE,
  WarehouseRebalancePayloadSchema,
} from "@/lib/jobs/warehouse-rebalance-queue";
import { WarehouseRebalancingAgent } from "@/lib/services/warehouse-intelligence";

const redisUrl = requireEnv("REDIS_URL");
const supabase = createAdminClient();
const agent = new WarehouseRebalancingAgent(supabase);

const worker = new Worker(
  WAREHOUSE_REBALANCE_QUEUE,
  async (job) => {
    if (job.name !== WAREHOUSE_REBALANCE_JOB) return;
    const payload = WarehouseRebalancePayloadSchema.parse(job.data);
    await agent.run(
      payload.tenantId,
      payload.signals.map((row) => ({
        tenantId: payload.tenantId,
        warehouseId: row.warehouseId,
        productId: row.productId,
        availableUnits: row.availableUnits,
        targetUnits: row.targetUnits,
      })),
    );
  },
  {
    connection: { url: redisUrl },
    concurrency: 2,
  },
);

worker.on("ready", () => {
  logger.info("Warehouse rebalance worker started", {
    operation: "worker.warehouse.rebalance.start",
  });
});

worker.on("failed", (job, error) => {
  logger.error("Warehouse rebalance worker failed", {
    operation: "worker.warehouse.rebalance.failed",
    jobId: job?.id,
    error: error.message,
  });
});

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}
