import type { IncomingMessage, ServerResponse } from "http";
import { CompleteMultipartUploadCommand, ListPartsCommand } from "@aws-sdk/client-s3";
import { authenticateRequest } from "../../../server/_core/authenticateRequest";
import {
  type UploadCategory,
  getR2Client,
  getR2Config,
  MULTIPART_MAX_PARTS,
  normalizeContentType,
  resolvePublicUrl,
} from "../../../server/_core/r2";
import { resolveOrganizationContext } from "../../../server/_core/context";
import { enqueueUploadedDocumentForOcr } from "../../../server/jobs/ocrUploadQueue";
import { createDocument, getDocumentByFileKey } from "../../../server/db";

type JsonBody = Record<string, unknown> | null;

async function readJsonBody(req: IncomingMessage): Promise<JsonBody> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  if (chunks.length === 0) return null;
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function json(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

async function getOcrQueueEncryptionMetadata(params: {
  organizationId: string | null;
  fileKey: string;
}): Promise<{ encryptionKeyVersion?: number; encryptionAlgorithm?: string }> {
  if (!params.organizationId || !params.fileKey) return {};
  const document = (await getDocumentByFileKey(params.fileKey, {
    organizationId: params.organizationId,
  })) as
    | {
        isEncrypted?: boolean | null;
        encryptionKeyVersion?: number | null;
        encryptionAlgorithm?: string | null;
      }
    | null;

  if (
    !document?.isEncrypted ||
    !Number.isInteger(document.encryptionKeyVersion) ||
    typeof document.encryptionAlgorithm !== "string" ||
    !document.encryptionAlgorithm
  ) {
    return {};
  }
  return {
    encryptionKeyVersion: Number(document.encryptionKeyVersion),
    encryptionAlgorithm: document.encryptionAlgorithm,
  };
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Method not allowed" });
  }

  let user: Awaited<ReturnType<typeof authenticateRequest>> = null;
  try {
    user = await authenticateRequest(req as never);
    if (!user) return json(res, 401, { error: "Unauthorized" });
  } catch {
    return json(res, 401, { error: "Unauthorized" });
  }

  const body = await readJsonBody(req);
  const uploadId = typeof body?.uploadId === "string" ? body.uploadId : "";
  const fileKey = typeof body?.fileKey === "string" ? body.fileKey : "";
  const fileType = typeof body?.fileType === "string" ? body.fileType : "";
  const fileSize = Number(body?.fileSize);
  const uploadType =
    typeof body?.uploadType === "string" ? (body.uploadType as UploadCategory) : "documents";
  const parts = Array.isArray(body?.parts)
    ? body?.parts
        .map((part) => {
          if (!part || typeof part !== "object") return null;
          const asPart = part as { partNumber?: unknown; eTag?: unknown };
          const partNumber = Number(asPart.partNumber);
          const eTag = typeof asPart.eTag === "string" ? asPart.eTag : "";
          return Number.isInteger(partNumber) && partNumber > 0 && eTag
            ? { PartNumber: partNumber, ETag: eTag }
            : null;
        })
        .filter((part): part is { PartNumber: number; ETag: string } => part !== null)
    : [];

  if (!uploadId || !fileKey || parts.length === 0) {
    return json(res, 400, { error: "uploadId, fileKey and parts are required" });
  }
  if (parts.length > MULTIPART_MAX_PARTS) {
    return json(res, 400, { error: `Maximum number of parts is ${MULTIPART_MAX_PARTS}` });
  }

  const uniquePartNumbers = new Set(parts.map((part) => part.PartNumber));
  if (uniquePartNumbers.size !== parts.length) {
    return json(res, 400, { error: "Duplicate partNumber values are not allowed" });
  }

  const orgContext = resolveOrganizationContext({
    req: req as never,
    explicitOrganizationId: body?.organizationId,
  });

  try {
    const listed = await getR2Client().send(
      new ListPartsCommand({
        Bucket: getR2Config().bucketName,
        Key: fileKey,
        UploadId: uploadId,
        MaxParts: MULTIPART_MAX_PARTS,
      })
    );
    const uploadedPartMap = new Map(
      (listed.Parts ?? []).map((part) => [part.PartNumber, (part.ETag ?? "").replaceAll('"', "")])
    );
    for (const part of parts) {
      const uploadedETag = uploadedPartMap.get(part.PartNumber)?.replaceAll('"', "");
      if (!uploadedETag || uploadedETag !== part.ETag.replaceAll('"', "")) {
        return json(res, 400, { error: `Part ${part.PartNumber} is missing or ETag does not match` });
      }
    }

    await getR2Client().send(
      new CompleteMultipartUploadCommand({
        Bucket: getR2Config().bucketName,
        Key: fileKey,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: [...parts].sort((a, b) => a.PartNumber - b.PartNumber),
        },
      })
    );

    const fileUrl = resolvePublicUrl(fileKey);
    const shouldQueueOcr = uploadType === "documents" || uploadType === "ocr";
    let queuedForOcr = false;
    const tenantId = orgContext.tenantId;
    if (
      shouldQueueOcr &&
      process.env.REDIS_URL &&
      tenantId != null &&
      Number.isInteger(tenantId) &&
      tenantId > 0
    ) {
      const encryptionMeta = await getOcrQueueEncryptionMetadata({
        organizationId: orgContext.organizationId,
        fileKey,
      });
      await enqueueUploadedDocumentForOcr({
        tenantId,
        tenant_id: tenantId,
        organizationId: orgContext.organizationId ?? undefined,
        encryptionKeyVersion: encryptionMeta.encryptionKeyVersion,
        encryptionAlgorithm: encryptionMeta.encryptionAlgorithm,
        requestedBy: user?.id ?? null,
        fileKey,
        fileType: normalizeContentType(fileType),
        fileUrl,
        uploadedAt: new Date().toISOString(),
      });
      queuedForOcr = true;
    }

    if (orgContext.organizationId && fileUrl && user?.id != null) {
      try {
        await createDocument({
          name: fileKey.split("/").pop() ?? fileKey,
          fileUrl,
          fileKey,
          fileType: normalizeContentType(fileType) || null,
          fileSize: Number.isFinite(fileSize) && fileSize > 0 ? fileSize : null,
          entityType: "organization",
          entityId: tenantId != null && Number.isInteger(tenantId) && tenantId > 0 ? tenantId : null,
          organizationId: orgContext.organizationId,
          uploadedBy: user.id,
        });
      } catch {
        // Non-blocking metadata write
      }
    }

    return json(res, 200, {
      fileKey,
      fileUrl,
      queuedForOcr,
    });
  } catch {
    return json(res, 500, { error: "Failed to complete multipart upload" });
  }
}
