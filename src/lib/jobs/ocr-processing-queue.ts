import { Queue } from "bullmq";
import { z } from "zod";

export const OCR_PROCESSING_QUEUE = "ocr-processing";
export const PROCESS_OCR_JOB = "process-ocr";

export const OCRJobPayloadSchema = z.object({
  receipt_id: z.string().uuid(),
  tenant_id: z.string().uuid().optional(),
  tenantId: z.string().uuid().optional(),
  business_id: z.string().uuid(),
  image_url: z.string().url(),
  idempotency_key: z.string().min(1),
});

export type OCRJobPayload = z.infer<typeof OCRJobPayloadSchema>;

let queue: Queue<OCRJobPayload> | null = null;

function getQueue(): Queue<OCRJobPayload> {
  if (queue) return queue;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error("Missing REDIS_URL for OCR processing queue");
  }
  queue = new Queue<OCRJobPayload>(OCR_PROCESSING_QUEUE, {
    connection: { url: redisUrl },
  });
  return queue;
}

export async function enqueueOCRProcessingJob(
  payload: OCRJobPayload,
): Promise<void> {
  const parsed = OCRJobPayloadSchema.parse(payload);
  const canonicalTenantId = parsed.tenant_id ?? parsed.tenantId ?? parsed.business_id;
  const q = getQueue();
  await q.add(
    PROCESS_OCR_JOB,
    {
      ...parsed,
      tenant_id: canonicalTenantId,
      tenantId: canonicalTenantId,
    },
    {
    jobId: parsed.receipt_id,
    attempts: 5,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: { age: 600, count: 1000 },
    removeOnFail: { age: 3600, count: 1000 },
    },
  );
}

