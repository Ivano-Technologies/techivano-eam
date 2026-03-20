import type { IncomingMessage, ServerResponse } from "http";
import { UploadPartCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { authenticateRequest } from "../../../server/_core/authenticateRequest";
import {
  getR2Client,
  getR2Config,
  getSignedUploadTtlSeconds,
  MULTIPART_MAX_PARTS,
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
  const uploadId = typeof body?.uploadId === "string" ? body.uploadId : "";
  const fileKey = typeof body?.fileKey === "string" ? body.fileKey : "";
  const partNumber = Number(body?.partNumber);

  if (!uploadId || !fileKey || !Number.isInteger(partNumber)) {
    return json(res, 400, { error: "uploadId, fileKey and partNumber are required" });
  }
  if (partNumber < 1 || partNumber > MULTIPART_MAX_PARTS) {
    return json(res, 400, { error: `partNumber must be between 1 and ${MULTIPART_MAX_PARTS}` });
  }

  try {
    const command = new UploadPartCommand({
      Bucket: getR2Config().bucketName,
      Key: fileKey,
      UploadId: uploadId,
      PartNumber: partNumber,
    });
    const uploadUrl = await getSignedUrl(getR2Client(), command, {
      expiresIn: getSignedUploadTtlSeconds(),
    });
    return json(res, 200, { uploadUrl });
  } catch {
    return json(res, 500, { error: "Failed to generate multipart part URL" });
  }
}
