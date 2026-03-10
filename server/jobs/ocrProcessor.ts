import type { OcrUploadJobPayload } from "./ocrUploadQueue";
import { resolveWorkerOcrPayloadContext } from "./workerDecrypt";
import { logger } from "../_core/logger";

/**
 * Process a single OCR upload job (process-uploaded-document).
 * Minimal viable: resolve context, log, succeed. Optional: fetch from R2, decrypt, run OCR, update document.
 */
export async function processOcrUploadJob(payload: OcrUploadJobPayload): Promise<{ success: boolean }> {
  const { tenantId, organizationId, encryption } = resolveWorkerOcrPayloadContext(payload);

  if (!tenantId || tenantId <= 0) {
    throw new Error("OCR job requires tenantId");
  }

  logger.info("OCR job processing", {
    fileKey: payload.fileKey,
    fileType: payload.fileType,
    tenantId,
    organizationId: organizationId ?? null,
    hasEncryption: !!encryption,
  });

  // Placeholder: no R2 fetch or OCR execution yet. Job completes successfully so the pipeline is unblocked.
  // To add later: fetch file from R2 by fileKey, decrypt if encryption present, run OCR, update document row.
  return { success: true };
}
