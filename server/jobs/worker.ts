import "../_core/loadEnv";
import { Job, Worker } from "bullmq";
import { ENV } from "../_core/env";
import { logger } from "../_core/logger";
import { getQueueName } from "./queue";
import { processJob } from "./processors";
import { markJobCompleted, markJobDead, markJobFailed, markJobRunning, normalizeJobError } from "./jobRunStore";
import type { BackgroundJobPayload, BackgroundJobName } from "./types";

async function runJob(job: Job<BackgroundJobPayload>) {
  const startedAtMs = Date.now();
  const payload = job.data;
  const runId = payload.runId ?? null;
  const currentAttempt = job.attemptsMade + 1;
  const maxAttempts = job.opts.attempts ?? ENV.queueDefaultAttempts;
  if (!payload.tenantId || payload.tenantId <= 0) {
    throw new Error("Tenant ID required");
  }

  if (runId) {
    await markJobRunning(runId, currentAttempt);
  }

  try {
    const result = await processJob(job.name as BackgroundJobName, payload);
    const durationMs = Date.now() - startedAtMs;
    if (runId) {
      await markJobCompleted(runId, result, currentAttempt, durationMs);
    }
    return result;
  } catch (error) {
    const normalizedError = normalizeJobError(error);
    const durationMs = Date.now() - startedAtMs;
    const isDead = currentAttempt >= maxAttempts;
    if (runId) {
      if (isDead) {
        await markJobDead(runId, normalizedError, currentAttempt, durationMs);
      } else {
        await markJobFailed(runId, normalizedError, currentAttempt, durationMs);
      }
    }
    throw error;
  }
}

const worker = new Worker<BackgroundJobPayload>(getQueueName(), runJob, {
  connection: {
    url: ENV.redisUrl,
  },
  concurrency: ENV.queueWorkerConcurrency,
});

worker.on("completed", job => {
  logger.info("Background job completed", {
    jobId: job.id,
    jobName: job.name,
  });
});

worker.on("failed", (job, error) => {
  logger.error("Background job failed", {
    jobId: job?.id,
    jobName: job?.name,
    error: error.message,
  });
});

logger.info("Background worker started", {
  queueName: getQueueName(),
  concurrency: ENV.queueWorkerConcurrency,
  redisUrl: ENV.redisUrl,
});
