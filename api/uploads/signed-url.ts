import type { IncomingMessage, ServerResponse } from "http";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { authenticateRequest } from "../../server/_core/authenticateRequest";
import {
  type UploadCategory,
  buildFileKey,
  getR2Client,
  getR2Config,
  getSignedUploadTtlSeconds,
  validateUploadRequest,
} from "../../server/_core/r2";

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
    typeof body?.uploadType === "string" ? (body.uploadType as UploadCategory) : "assets";

  if (!fileName || !fileType || !Number.isFinite(fileSize)) {
    return json(res, 400, { error: "fileName, fileType and fileSize are required" });
  }

  const allowedCategories: UploadCategory[] = ["assets", "inspection-images", "documents", "ocr"];
  if (!allowedCategories.includes(uploadType)) {
    return json(res, 400, { error: `uploadType must be one of: ${allowedCategories.join(", ")}` });
  }

  try {
    validateUploadRequest({
      category: uploadType,
      fileType,
      fileSize,
    });
  } catch (error) {
    return json(res, 400, {
      error: error instanceof Error ? error.message : "Invalid upload payload",
    });
  }

  try {
    const fileKey = buildFileKey(uploadType, fileName);
    const r2Config = getR2Config();
    const putCommand = new PutObjectCommand({
      Bucket: r2Config.bucketName,
      Key: fileKey,
      ContentType: fileType,
    });
    const uploadUrl = await getSignedUrl(getR2Client(), putCommand, {
      expiresIn: getSignedUploadTtlSeconds(),
    });
    return json(res, 200, {
      uploadUrl,
      fileKey,
      expiresInSeconds: getSignedUploadTtlSeconds(),
    });
  } catch {
    return json(res, 500, { error: "Failed to create signed upload URL" });
  }
}
