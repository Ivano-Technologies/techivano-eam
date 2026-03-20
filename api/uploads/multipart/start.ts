import type { IncomingMessage, ServerResponse } from "http";
import { CreateMultipartUploadCommand } from "@aws-sdk/client-s3";
import { authenticateRequest } from "../../../server/_core/authenticateRequest";
import {
  type UploadCategory,
  buildFileKey,
  getR2Client,
  getR2Config,
  MULTIPART_MAX_PARTS,
  MULTIPART_PART_SIZE_BYTES,
  normalizeContentType,
  validateMultipartStartRequest,
} from "../../../server/_core/r2";

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

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const user = await authenticateRequest(req as never);
    if (!user) return json(res, 401, { error: "Unauthorized" });
  } catch {
    return json(res, 401, { error: "Unauthorized" });
  }

  const body = await readJsonBody(req);
  const fileName = typeof body?.fileName === "string" ? body.fileName : "";
  const fileType = typeof body?.fileType === "string" ? body.fileType : "";
  const fileSize = Number(body?.fileSize);
  const uploadType =
    typeof body?.uploadType === "string" ? (body.uploadType as UploadCategory) : "documents";

  if (!fileName || !fileType || !Number.isFinite(fileSize)) {
    return json(res, 400, { error: "fileName, fileType and fileSize are required" });
  }

  const allowedCategories: UploadCategory[] = ["assets", "inspection-images", "documents", "ocr"];
  if (!allowedCategories.includes(uploadType)) {
    return json(res, 400, { error: `uploadType must be one of: ${allowedCategories.join(", ")}` });
  }

  try {
    validateMultipartStartRequest({ fileType, fileSize });
  } catch (error) {
    return json(res, 400, {
      error: error instanceof Error ? error.message : "Invalid multipart payload",
    });
  }

  try {
    const normalizedType = normalizeContentType(fileType);
    const fileKey = buildFileKey(uploadType, fileName);
    const command = new CreateMultipartUploadCommand({
      Bucket: getR2Config().bucketName,
      Key: fileKey,
      ContentType: normalizedType,
    });
    const response = await getR2Client().send(command);

    if (!response.UploadId) {
      return json(res, 500, { error: "Failed to initialize multipart upload" });
    }

    return json(res, 200, {
      uploadId: response.UploadId,
      fileKey,
      partSize: MULTIPART_PART_SIZE_BYTES,
      maxParts: MULTIPART_MAX_PARTS,
    });
  } catch {
    return json(res, 500, { error: "Failed to start multipart upload" });
  }
}
