import { Queue } from "bullmq";
import { ENV } from "../_core/env";

export const OCR_UPLOAD_QUEUE_NAME = "ocr-processing";
export const OCR_UPLOAD_JOB_NAME = "process-uploaded-document";

export interface OcrUploadJobPayload {
  tenantId: number;
  requestedBy: number | null;
  fileKey: string;
  fileType: string;
  fileUrl: string;
  uploadedAt: string;
}

let queue: Queue<OcrUploadJobPayload> | null = null;

function getQueue() {
  if (queue) return queue;
  queue = new Queue<OcrUploadJobPayload>(OCR_UPLOAD_QUEUE_NAME, {
    connection: { url: ENV.redisUrl },
  });
  return queue;
}

export async function enqueueUploadedDocumentForOcr(payload: OcrUploadJobPayload) {
  const q = getQueue();
  await q.add(OCR_UPLOAD_JOB_NAME, payload, {
    jobId: `${payload.tenantId}:${payload.fileKey}`,
    attempts: ENV.queueDefaultAttempts,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: { age: 3600, count: 1000 },
    removeOnFail: { age: 24 * 3600, count: 1000 },
  });
}
