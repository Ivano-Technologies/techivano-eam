import { JobsOptions, Queue } from "bullmq";
import { ENV } from "../_core/env";
import { logger } from "../_core/logger";
import { createJobRun, markJobQueued } from "./jobRunStore";
import type {
  BackgroundJobName,
  BackgroundJobPayload,
  ComplianceEvaluateJobPayload,
  InspectionEvaluateJobPayload,
  InspectionScheduleJobPayload,
  PmEvaluationJobPayload,
  PredictiveScoringJobPayload,
  ReportAnalyticsJobPayload,
  ReportGenerationJobPayload,
  SlaCalculationJobPayload,
  StockAllocateInventoryJobPayload,
  StockDetectAnomaliesJobPayload,
  StockPredictDemandJobPayload,
  StockRecommendSubstitutionJobPayload,
  TelemetryAggregationJobPayload,
  VendorEvaluatePerformanceJobPayload,
  WarehouseOptimizeLayoutJobPayload,
  WarehouseRebalanceStockJobPayload,
} from "./types";

const QUEUE_NAME = "eam-background-jobs";

let backgroundQueue: Queue<BackgroundJobPayload, unknown, BackgroundJobName> | null = null;

function getQueue(): Queue<BackgroundJobPayload, unknown, BackgroundJobName> {
  if (!backgroundQueue) {
    backgroundQueue = new Queue<BackgroundJobPayload, unknown, BackgroundJobName>(QUEUE_NAME, {
      connection: {
        url: ENV.redisUrl,
      },
      defaultJobOptions: {
        attempts: ENV.queueDefaultAttempts,
        removeOnComplete: 500,
        removeOnFail: 500,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
      },
    });
    logger.info("Background queue initialized", { queueName: QUEUE_NAME });
  }
  return backgroundQueue;
}

type EnqueueParams<T extends BackgroundJobPayload> = {
  jobName: BackgroundJobName;
  payload: T;
  options?: JobsOptions;
};

async function enqueueJob<T extends BackgroundJobPayload>(params: EnqueueParams<T>) {
  if (!params.payload.tenantId || params.payload.tenantId <= 0) {
    throw new Error("Tenant ID required");
  }

  const runId = await createJobRun({
    tenantId: params.payload.tenantId,
    jobName: params.jobName,
    requestedBy: params.payload.requestedBy,
    payload: params.payload,
    maxAttempts: params.options?.attempts ?? ENV.queueDefaultAttempts,
  });

  const payloadWithRunId = {
    ...params.payload,
    runId,
  } as T;

  const queue = getQueue();
  const queueJob = await queue.add(params.jobName, payloadWithRunId, params.options);

  if (runId) {
    await markJobQueued(runId, queueJob.id ?? "");
  }

  return {
    runId,
    queueJobId: queueJob.id ?? null,
    jobName: params.jobName,
  };
}

export async function enqueuePmEvaluationJob(payload: Omit<PmEvaluationJobPayload, "runId" | "requestedAt">) {
  return enqueueJob({
    jobName: "pm-evaluation",
    payload: {
      ...payload,
      runId: null,
      requestedAt: new Date().toISOString(),
    },
  });
}

export async function enqueuePredictiveScoringJob(payload: Omit<PredictiveScoringJobPayload, "runId" | "requestedAt">) {
  return enqueueJob({
    jobName: "predictive.scoreAssets",
    payload: {
      ...payload,
      runId: null,
      requestedAt: new Date().toISOString(),
    },
  });
}

export async function enqueueReportGenerationJob(payload: Omit<ReportGenerationJobPayload, "runId" | "requestedAt">) {
  return enqueueJob({
    jobName: "reports.generateSnapshot",
    payload: {
      ...payload,
      runId: null,
      requestedAt: new Date().toISOString(),
    },
  });
}

export async function enqueueTelemetryAggregationJob(
  payload: Omit<TelemetryAggregationJobPayload, "runId" | "requestedAt">
) {
  return enqueueJob({
    jobName: "telemetry.aggregateHourly",
    payload: {
      ...payload,
      runId: null,
      requestedAt: new Date().toISOString(),
    },
  });
}

export async function enqueueInspectionScheduleJob(
  payload: Omit<InspectionScheduleJobPayload, "runId" | "requestedAt">
) {
  return enqueueJob({
    jobName: "inspection.schedule",
    payload: {
      ...payload,
      runId: null,
      requestedAt: new Date().toISOString(),
    },
  });
}

export async function enqueueInspectionEvaluateJob(
  payload: Omit<InspectionEvaluateJobPayload, "runId" | "requestedAt">
) {
  return enqueueJob({
    jobName: "inspection.evaluate",
    payload: {
      ...payload,
      runId: null,
      requestedAt: new Date().toISOString(),
    },
  });
}

export async function enqueueComplianceEvaluateJob(
  payload: Omit<ComplianceEvaluateJobPayload, "runId" | "requestedAt">
) {
  return enqueueJob({
    jobName: "compliance.evaluate",
    payload: {
      ...payload,
      runId: null,
      requestedAt: new Date().toISOString(),
    },
  });
}

export async function enqueueSlaCalculationJob(
  payload: Omit<SlaCalculationJobPayload, "runId" | "requestedAt">
) {
  return enqueueJob({
    jobName: "sla.calculate",
    payload: {
      ...payload,
      runId: null,
      requestedAt: new Date().toISOString(),
    },
  });
}

export async function enqueueReportGenerateAnalyticsJob(
  payload: Omit<ReportAnalyticsJobPayload, "runId" | "requestedAt">
) {
  return enqueueJob({
    jobName: "report.generateAnalytics",
    payload: {
      ...payload,
      runId: null,
      requestedAt: new Date().toISOString(),
    },
  });
}

export async function enqueueStockPredictDemandJob(
  payload: Omit<StockPredictDemandJobPayload, "runId" | "requestedAt">
) {
  return enqueueJob({
    jobName: "stock.predictDemand",
    payload: {
      ...payload,
      runId: null,
      requestedAt: new Date().toISOString(),
    },
  });
}

export async function enqueueStockRecommendSubstitutionJob(
  payload: Omit<StockRecommendSubstitutionJobPayload, "runId" | "requestedAt">
) {
  return enqueueJob({
    jobName: "stock.recommendSubstitution",
    payload: {
      ...payload,
      runId: null,
      requestedAt: new Date().toISOString(),
    },
  });
}

export async function enqueueStockAllocateInventoryJob(
  payload: Omit<StockAllocateInventoryJobPayload, "runId" | "requestedAt">
) {
  return enqueueJob({
    jobName: "stock.allocateInventory",
    payload: {
      ...payload,
      runId: null,
      requestedAt: new Date().toISOString(),
    },
  });
}

export async function enqueueStockDetectAnomaliesJob(
  payload: Omit<StockDetectAnomaliesJobPayload, "runId" | "requestedAt">
) {
  return enqueueJob({
    jobName: "stock.detectAnomalies",
    payload: {
      ...payload,
      runId: null,
      requestedAt: new Date().toISOString(),
    },
  });
}

export async function enqueueWarehouseOptimizeLayoutJob(
  payload: Omit<WarehouseOptimizeLayoutJobPayload, "runId" | "requestedAt">
) {
  return enqueueJob({
    jobName: "warehouse.optimizeLayout",
    payload: {
      ...payload,
      runId: null,
      requestedAt: new Date().toISOString(),
    },
  });
}

export async function enqueueWarehouseRebalanceStockJob(
  payload: Omit<WarehouseRebalanceStockJobPayload, "runId" | "requestedAt">
) {
  return enqueueJob({
    jobName: "warehouse.rebalanceStock",
    payload: {
      ...payload,
      runId: null,
      requestedAt: new Date().toISOString(),
    },
  });
}

export async function enqueueVendorEvaluatePerformanceJob(
  payload: Omit<VendorEvaluatePerformanceJobPayload, "runId" | "requestedAt">
) {
  return enqueueJob({
    jobName: "vendor.evaluatePerformance",
    payload: {
      ...payload,
      runId: null,
      requestedAt: new Date().toISOString(),
    },
  });
}

export function getQueueName() {
  return QUEUE_NAME;
}

export function getBackgroundQueue() {
  return getQueue();
}
