import { JobsOptions, Queue } from "bullmq";
import { ENV } from "../_core/env";
import { logger } from "../_core/logger";
import { createJobRun, markJobQueued } from "./jobRunStore";
import type {
  BackgroundJobName,
  BackgroundJobPayload,
  PmEvaluationJobPayload,
  PredictiveScoringJobPayload,
  ReportGenerationJobPayload,
  TelemetryAggregationJobPayload,
  WarehouseRebalanceJobPayload,
  VendorRiskScoringJobPayload,
  ProcurementRecommendationJobPayload,
  SupplyChainRiskEvaluationJobPayload,
  DispatchOptimizationJobPayload,
  ExecutiveMetricsJobPayload,
} from "./types";

const QUEUE_NAME = "eam-background-jobs";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

let backgroundQueue: Queue<BackgroundJobPayload, unknown, BackgroundJobName> | null = null;
let hasLoggedDevDisable = false;

function queueEnabled(): boolean {
  if (!IS_PRODUCTION) {
    if (!hasLoggedDevDisable) {
      logger.info("Queue disabled in development");
      hasLoggedDevDisable = true;
    }
    return false;
  }
  return true;
}

function getQueue(): Queue<BackgroundJobPayload, unknown, BackgroundJobName> {
  if (!queueEnabled()) {
    throw new Error("Background queue is disabled outside production");
  }
  if (process.env.E2E === "1") {
    throw new Error("Background queue is disabled in E2E mode (Redis not used)");
  }
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
  if (!queueEnabled() || process.env.E2E === "1") {
    return {
      runId: null,
      queueJobId: null,
      jobName: params.jobName,
      skipped: true,
    };
  }

  const runId = await createJobRun({
    tenantId: params.payload.tenantId,
    jobName: params.jobName,
    requestedBy: params.payload.requestedBy,
    payload: params.payload,
    maxAttempts: params.options?.attempts,
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

export async function enqueueWarehouseRebalanceJob(
  payload: Omit<WarehouseRebalanceJobPayload, "runId" | "requestedAt">
) {
  return enqueueJob({
    jobName: "warehouse.rebalanceStock",
    payload: {
      ...payload,
      runId: null,
      requestedAt: new Date().toISOString(),
    },
    options: {
      jobId: `warehouse:rebalance:${payload.tenantId}:${payload.stockItemId}`,
    },
  });
}

export async function enqueueVendorRiskScoringJob(
  payload: Omit<VendorRiskScoringJobPayload, "runId" | "requestedAt">
) {
  return enqueueJob({
    jobName: "vendor.computeRiskScores",
    payload: {
      ...payload,
      runId: null,
      requestedAt: new Date().toISOString(),
    },
    options: payload.vendorId
      ? { jobId: `vendor:risk:${payload.tenantId}:${payload.vendorId}` }
      : { jobId: `vendor:risk:${payload.tenantId}:all` },
  });
}

export async function enqueueProcurementRecommendationJob(
  payload: Omit<ProcurementRecommendationJobPayload, "runId" | "requestedAt">
) {
  return enqueueJob({
    jobName: "procurement.generateRecommendations",
    payload: {
      ...payload,
      runId: null,
      requestedAt: new Date().toISOString(),
    },
    options: payload.stockItemId
      ? { jobId: `procurement:recommend:${payload.tenantId}:${payload.stockItemId}` }
      : { jobId: `procurement:recommend:${payload.tenantId}:all` },
  });
}

export async function enqueueSupplyChainRiskEvaluationJob(
  payload: Omit<SupplyChainRiskEvaluationJobPayload, "runId" | "requestedAt">
) {
  return enqueueJob({
    jobName: "supplychain.evaluateRisk",
    payload: {
      ...payload,
      runId: null,
      requestedAt: new Date().toISOString(),
    },
    options: payload.stockItemId
      ? { jobId: `supplychain:risk:${payload.tenantId}:${payload.stockItemId}:${payload.vendorId ?? "all"}` }
      : { jobId: `supplychain:risk:${payload.tenantId}:all` },
  });
}

export async function enqueueDispatchOptimizationJob(
  payload: Omit<DispatchOptimizationJobPayload, "runId" | "requestedAt">
) {
  return enqueueJob({
    jobName: "dispatch.optimizeAssignments",
    payload: {
      ...payload,
      runId: null,
      requestedAt: new Date().toISOString(),
    },
    options: payload.workOrderId
      ? { jobId: `dispatch:optimize:${payload.tenantId}:${payload.workOrderId}:${payload.facilityId ?? "all"}` }
      : { jobId: `dispatch:optimize:${payload.tenantId}:all` },
  });
}

export async function enqueueExecutiveMetricsJob(
  payload: Omit<ExecutiveMetricsJobPayload, "runId" | "requestedAt">
) {
  return enqueueJob({
    jobName: "executive.computeMetrics",
    payload: {
      ...payload,
      runId: null,
      requestedAt: new Date().toISOString(),
    },
    options: {
      jobId: `executive:metrics:${payload.tenantId}:${payload.snapshotDate ?? "latest"}`,
    },
  });
}

export function getQueueName() {
  return QUEUE_NAME;
}

export function getBackgroundQueue() {
  if (!queueEnabled()) {
    return null;
  }
  return getQueue();
}
