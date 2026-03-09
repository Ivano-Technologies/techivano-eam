import { Queue } from "bullmq";
import { ENV } from "../_core/env";
import { normalizeOrganizationId } from "../db";

export const OCR_UPLOAD_QUEUE_NAME = "ocr-processing";
export const OCR_UPLOAD_JOB_NAME = "process-uploaded-document";

export interface OcrUploadJobPayload {
  tenantId: number;
  tenant_id?: number;
  organizationId?: string | number;
  encryptionKeyVersion?: number;
  encryptionAlgorithm?: string;
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

function parsePositiveInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeOptionalOrganizationId(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  try {
    if (typeof value === "string" || typeof value === "number") {
      return normalizeOrganizationId(value);
    }
  } catch {
    // Ignore invalid organization identifiers for backward-compatible queueing.
  }
  return undefined;
}

function resolveOptionalEncryptionMetadata(payload: OcrUploadJobPayload): {
  encryptionKeyVersion?: number;
  encryptionAlgorithm?: string;
} {
  const keyVersion = parsePositiveInteger(payload.encryptionKeyVersion);
  const algorithm =
    typeof payload.encryptionAlgorithm === "string" && payload.encryptionAlgorithm.trim()
      ? payload.encryptionAlgorithm.trim().toLowerCase()
      : "";

  // Require both fields to avoid half-populated metadata contracts.
  if (!keyVersion || !algorithm) {
    return {};
  }

  return {
    encryptionKeyVersion: keyVersion,
    encryptionAlgorithm: algorithm,
  };
}

export async function enqueueUploadedDocumentForOcr(payload: OcrUploadJobPayload) {
  const rawTenantId = Number.isInteger(payload.tenantId) && payload.tenantId > 0
    ? payload.tenantId
    : payload.tenant_id;
  if (rawTenantId == null || !Number.isInteger(rawTenantId) || rawTenantId <= 0) {
    throw new Error("tenantId is required to enqueue OCR upload job");
  }
  const canonicalTenantId: number = rawTenantId;

  const normalizedPayload: OcrUploadJobPayload = {
    ...payload,
    tenantId: canonicalTenantId,
    tenant_id: canonicalTenantId,
    organizationId: normalizeOptionalOrganizationId(payload.organizationId),
    ...resolveOptionalEncryptionMetadata(payload),
  };
  const q = getQueue();
  await q.add(OCR_UPLOAD_JOB_NAME, normalizedPayload, {
    jobId: `${canonicalTenantId}:${payload.fileKey}`,
    attempts: ENV.queueDefaultAttempts,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: { age: 3600, count: 1000 },
    removeOnFail: { age: 24 * 3600, count: 1000 },
  });
}
