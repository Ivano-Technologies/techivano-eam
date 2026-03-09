import { decryptBufferAesGcm } from "../_core/encryption";
import { normalizeOrganizationId } from "../db";
import { getOrganizationEncryptionKeyMaterial } from "../db";

export interface WorkerEncryptedBlob {
  organizationId: number | string;
  keyVersion: number;
  algorithm?: string;
  ciphertextBase64: string;
  ivBase64: string;
  authTagBase64: string;
}

type OcrQueuePayloadLike = {
  tenantId?: unknown;
  tenant_id?: unknown;
  organizationId?: unknown;
  organization_id?: unknown;
  encryptionKeyVersion?: unknown;
  encryption_key_version?: unknown;
  encryptionAlgorithm?: unknown;
  encryption_algorithm?: unknown;
};

function parsePositiveInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function resolveWorkerTenantId(payload: OcrQueuePayloadLike): number | null {
  return parsePositiveInteger(payload.tenantId) ?? parsePositiveInteger(payload.tenant_id);
}

export function resolveWorkerOrganizationId(payload: OcrQueuePayloadLike): string | null {
  const organizationId = payload.organizationId ?? payload.organization_id;
  if (organizationId === null || organizationId === undefined) return null;
  try {
    if (typeof organizationId === "string" || typeof organizationId === "number") {
      return normalizeOrganizationId(organizationId);
    }
    return null;
  } catch {
    return null;
  }
}

export function resolveWorkerEncryptionMetadata(payload: OcrQueuePayloadLike): {
  keyVersion: number;
  algorithm: string;
} | null {
  const keyVersion =
    parsePositiveInteger(payload.encryptionKeyVersion) ??
    parsePositiveInteger(payload.encryption_key_version);
  const algorithm =
    typeof (payload.encryptionAlgorithm ?? payload.encryption_algorithm) === "string" &&
    (payload.encryptionAlgorithm ?? payload.encryption_algorithm)?.trim()
      ? String(payload.encryptionAlgorithm ?? payload.encryption_algorithm).trim().toLowerCase()
      : "";
  if (!keyVersion || !algorithm) return null;
  if (algorithm !== "aes-256-gcm") return null;
  return { keyVersion, algorithm };
}

export function resolveWorkerOcrPayloadContext(payload: OcrQueuePayloadLike): {
  tenantId: number | null;
  organizationId: string | null;
  encryption: {
    keyVersion: number;
    algorithm: string;
  } | null;
} {
  return {
    tenantId: resolveWorkerTenantId(payload),
    organizationId: resolveWorkerOrganizationId(payload),
    encryption: resolveWorkerEncryptionMetadata(payload),
  };
}

export function assertWorkerPayloadOrganizationScope(params: {
  payload: OcrQueuePayloadLike;
  expectedOrganizationId: string;
}) {
  const { organizationId } = resolveWorkerOcrPayloadContext(params.payload);
  const expectedOrgId = normalizeOrganizationId(params.expectedOrganizationId);
  if (!organizationId) {
    throw new Error("OCR payload organizationId is required for organization-scoped processing");
  }
  if (organizationId !== expectedOrgId) {
    throw new Error("OCR payload organizationId does not match worker organization scope");
  }
}

/**
 * Worker-safe decrypt flow:
 * - key is loaded and unwrapped server-side only
 * - ciphertext is decrypted in memory
 * - caller is responsible for zeroing/disposing buffers after use
 */
export async function decryptWorkerPayloadInMemory(payload: WorkerEncryptedBlob): Promise<Buffer> {
  let normalizedOrganizationId: string;
  try {
    normalizedOrganizationId = normalizeOrganizationId(payload.organizationId);
  } catch {
    throw new Error("organizationId must be a valid UUID or positive tenant id");
  }
  if (!Number.isInteger(payload.keyVersion) || payload.keyVersion <= 0) {
    throw new Error("keyVersion must be a positive integer");
  }
  if (payload.algorithm && payload.algorithm !== "aes-256-gcm") {
    throw new Error(`Unsupported algorithm: ${payload.algorithm}`);
  }

  const keyMaterial = await getOrganizationEncryptionKeyMaterial(
    normalizedOrganizationId,
    payload.keyVersion
  );
  if (!keyMaterial) {
    throw new Error("No organization key material found for decrypt");
  }

  return decryptBufferAesGcm(
    Buffer.from(payload.ciphertextBase64, "base64"),
    keyMaterial.dataKey,
    Buffer.from(payload.ivBase64, "base64"),
    Buffer.from(payload.authTagBase64, "base64"),
  );
}

