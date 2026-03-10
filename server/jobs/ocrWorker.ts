import "../_core/loadEnv";
import { Worker } from "bullmq";
import { ENV } from "../_core/env";
import { logger } from "../_core/logger";
import {
  OCR_UPLOAD_QUEUE_NAME,
  OCR_UPLOAD_JOB_NAME,
  type OcrUploadJobPayload,
} from "./ocrUploadQueue";
import { processOcrUploadJob } from "./ocrProcessor";

async function runOcrJob(job: { id?: string; name: string; data: OcrUploadJobPayload }) {
  const payload = job.data;
  try {
    const result = await processOcrUploadJob(payload);
    return result;
  } catch (error) {
    logger.error("OCR job failed", {
      jobId: job.id,
      jobName: job.name,
      fileKey: payload.fileKey,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

const worker = new Worker<OcrUploadJobPayload>(
  OCR_UPLOAD_QUEUE_NAME,
  async (job) => runOcrJob(job),
  {
    connection: { url: ENV.redisUrl },
    concurrency: Math.max(1, Math.min(4, ENV.queueWorkerConcurrency)),
    limiter: { max: 10, duration: 60_000 },
  }
);

worker.on("completed", (job) => {
  logger.info("OCR job completed", { jobId: job.id, jobName: job.name });
});

worker.on("failed", (job, error) => {
  logger.error("OCR job failed (worker event)", {
    jobId: job?.id,
    jobName: job?.name,
    error: error?.message,
  });
});

logger.info("OCR worker started", {
  queueName: OCR_UPLOAD_QUEUE_NAME,
  jobName: OCR_UPLOAD_JOB_NAME,
  redisUrl: ENV.redisUrl ? "set" : "missing",
});
