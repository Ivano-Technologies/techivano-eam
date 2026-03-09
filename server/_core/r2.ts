import { S3Client } from "@aws-sdk/client-s3";

export type UploadCategory =
  | "assets"
  | "inspection-images"
  | "documents"
  | "ocr";

const CATEGORY_CONTENT_TYPES: Record<UploadCategory, ReadonlyArray<string>> = {
  assets: ["image/jpeg", "image/png", "image/webp"],
  "inspection-images": ["image/jpeg", "image/png", "image/webp"],
  documents: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
  ocr: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
};

const CATEGORY_MAX_BYTES: Record<UploadCategory, number> = {
  assets: 10 * 1024 * 1024,
  "inspection-images": 10 * 1024 * 1024,
  documents: 30 * 1024 * 1024,
  ocr: 30 * 1024 * 1024,
};

const SIGNED_UPLOAD_TTL_SECONDS = 60 * 5;
export const MULTIPART_PART_SIZE_BYTES = 8 * 1024 * 1024; // 8MB
export const MULTIPART_MAX_PARTS = 1000;
export const MULTIPART_MAX_FILE_SIZE_BYTES = MULTIPART_PART_SIZE_BYTES * MULTIPART_MAX_PARTS;

const MULTIPART_ALLOWED_CONTENT_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
]);

let cachedClient: S3Client | null = null;

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getR2Config() {
  return {
    bucketName: getRequiredEnv("R2_BUCKET_NAME"),
    endpoint: getRequiredEnv("R2_ENDPOINT"),
    accessKeyId: getRequiredEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: getRequiredEnv("R2_SECRET_ACCESS_KEY"),
    publicBaseUrl: process.env.R2_PUBLIC_BASE_URL?.replace(/\/+$/, "") ?? "",
  };
}

export function getR2Client() {
  if (cachedClient) return cachedClient;
  const config = getR2Config();
  cachedClient = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: true,
  });
  return cachedClient;
}

function sanitizeFileName(fileName: string) {
  const trimmed = fileName.trim();
  const safe = trimmed.replace(/[^a-zA-Z0-9._-]/g, "_");
  return safe.length > 0 ? safe : "upload.bin";
}

export function buildFileKey(category: UploadCategory, fileName: string) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const safeName = sanitizeFileName(fileName);
  const id = crypto.randomUUID();
  return `${category}/${year}/${month}/${id}-${safeName}`;
}

export function validateUploadRequest(input: {
  category: UploadCategory;
  fileType: string;
  fileSize: number;
}) {
  const normalizedType = input.fileType.toLowerCase();
  const allowedTypes = CATEGORY_CONTENT_TYPES[input.category];
  if (!allowedTypes.includes(normalizedType)) {
    throw new Error(
      `Unsupported file type for ${input.category}. Allowed: ${allowedTypes.join(", ")}`
    );
  }

  const maxBytes = CATEGORY_MAX_BYTES[input.category];
  if (input.fileSize <= 0 || input.fileSize > maxBytes) {
    throw new Error(
      `Invalid file size for ${input.category}. Maximum allowed: ${Math.floor(
        maxBytes / (1024 * 1024)
      )}MB`
    );
  }
}

export function getSignedUploadTtlSeconds() {
  return SIGNED_UPLOAD_TTL_SECONDS;
}

export function normalizeContentType(fileType: string) {
  const normalized = fileType.toLowerCase().trim();
  if (normalized === "image/jpg") {
    return "image/jpeg";
  }
  return normalized;
}

export function validateMultipartStartRequest(input: {
  fileType: string;
  fileSize: number;
}) {
  const normalizedType = normalizeContentType(input.fileType);
  if (!MULTIPART_ALLOWED_CONTENT_TYPES.has(normalizedType)) {
    throw new Error("Unsupported multipart file type. Allowed: pdf, png, jpg, jpeg");
  }

  if (input.fileSize <= 0 || input.fileSize > MULTIPART_MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `Invalid multipart file size. Maximum allowed: ${Math.floor(
        MULTIPART_MAX_FILE_SIZE_BYTES / (1024 * 1024)
      )}MB`
    );
  }
}

export function resolvePublicUrl(fileKey: string) {
  const { publicBaseUrl } = getR2Config();
  if (!publicBaseUrl) {
    return "";
  }
  return `${publicBaseUrl}/${fileKey}`;
}
