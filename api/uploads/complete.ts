import type { IncomingMessage, ServerResponse } from "http";
import { authenticateRequest } from "../../server/_core/authenticateRequest";
import { resolvePublicUrl, type UploadCategory } from "../../server/_core/r2";

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
  const fileKey = typeof body?.fileKey === "string" ? body.fileKey : "";
  const fileType = typeof body?.fileType === "string" ? body.fileType : "";
  const uploadType =
    typeof body?.uploadType === "string" ? (body.uploadType as UploadCategory) : "assets";

  if (!fileKey || !fileType) {
    return json(res, 400, { error: "fileKey and fileType are required" });
  }

  const allowedCategories: UploadCategory[] = ["assets", "inspection-images", "documents", "ocr"];
  if (!allowedCategories.includes(uploadType)) {
    return json(res, 400, { error: `uploadType must be one of: ${allowedCategories.join(", ")}` });
  }

  return json(res, 200, {
    fileKey,
    fileUrl: resolvePublicUrl(fileKey),
    queuedForOcr: false,
  });
}
