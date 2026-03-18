import "dotenv/config";
// Initialize Sentry first for error tracking
import { initSentry } from "./sentry";
initSentry();

// In development, keep the server running when Redis (or other deps) fail so Supabase auth can be tested without Redis
if (process.env.NODE_ENV === "development") {
  process.on("unhandledRejection", (reason, promise) => {
    console.error("[dev] Unhandled rejection (server will keep running):", reason);
  });
  const hasCustomGoogle = Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID?.trim());
  console.log("[dev] Custom Google OAuth (continue to EAM):", hasCustomGoogle ? "enabled" : "not configured (using Supabase Google)");
}

import express from "express";
import fs from "fs";
import { createServer } from "http";
import net from "net";
import path from "path";
import {
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  ListPartsCommand,
  PutObjectCommand,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "node:stream";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { appRouter } from "../routers";
import { createContext, getAppVariantFromHost, getHostFromRequest, resolveOrganizationContext } from "./context";
import { authenticateRequest } from "./authenticateRequest";
import { serveStatic, setupVite, setupViteModuleMiddleware } from "./vite";
import { getBackgroundQueue } from "../jobs/queue";
import { sdk } from "./sdk";
import { enqueueWarehouseRebalanceJob } from "../jobs/queue";
import {
  buildFileKey,
  getR2Client,
  getR2Config,
  getSignedUploadTtlSeconds,
  MULTIPART_MAX_PARTS,
  MULTIPART_PART_SIZE_BYTES,
  normalizeContentType,
  resolvePublicUrl,
  validateMultipartStartRequest,
  validateUploadRequest,
  type UploadCategory,
} from "./r2";
import {
  createInitialOrganizationEncryptionKey,
  createEncryptedDocumentMetadata,
  getActiveOrganizationEncryptionKey,
  getDocumentByFileKey,
  getDocumentById,
  listWarehouseTransferRecommendations,
  normalizeOrganizationId,
  rotateOrganizationEncryptionKey,
} from "../db";
import { enqueueUploadedDocumentForOcr } from "../jobs/ocrUploadQueue";
import {
  decryptBufferAesGcm,
  decryptOrgDataKey,
  encryptBufferAesGcm,
} from "./encryption";
import { validateProductionEnv } from "./envValidation";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

function getOrganizationIdFromRequest(
  req: express.Request,
  bodyOrganizationId?: unknown
): { tenantId: number | null; organizationId: string | null } {
  return resolveOrganizationContext({
    req,
    explicitOrganizationId: bodyOrganizationId,
  });
}

function parseBase64Payload(input: string): Buffer {
  const trimmed = input.trim();
  const base64Payload = trimmed.includes(",") ? trimmed.split(",").pop() ?? "" : trimmed;
  if (!base64Payload) {
    throw new Error("Empty base64 payload");
  }
  const sanitized = base64Payload.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/=]+$/.test(sanitized)) {
    throw new Error("Invalid base64 payload");
  }
  return Buffer.from(sanitized, "base64");
}

async function getOcrQueueEncryptionMetadata(params: {
  organizationId: string | null;
  fileKey: string;
}): Promise<{ encryptionKeyVersion?: number; encryptionAlgorithm?: string }> {
  if (!params.organizationId || !params.fileKey) {
    return {};
  }
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

async function s3BodyToBuffer(body: unknown): Promise<Buffer> {
  if (!body) {
    throw new Error("Missing S3 response body");
  }
  if (Buffer.isBuffer(body)) {
    return body;
  }
  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }
  if (typeof body === "string") {
    return Buffer.from(body);
  }
  if (typeof (body as { transformToByteArray?: () => Promise<Uint8Array> }).transformToByteArray === "function") {
    const bytes = await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
    return Buffer.from(bytes);
  }
  if (body instanceof Readable || typeof (body as AsyncIterable<Uint8Array>)[Symbol.asyncIterator] === "function") {
    const chunks: Buffer[] = [];
    for await (const chunk of body as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  throw new Error("Unsupported S3 body type");
}

async function startServer() {
  validateProductionEnv();

  const app = express();
  const server = createServer(app);

  let devVite: Awaited<ReturnType<typeof setupViteModuleMiddleware>>["vite"] | undefined;
  // In development, handle /@vite/* and /src/* first so they never get HTML from any later middleware.
  if (process.env.NODE_ENV === "development") {
    const out = await setupViteModuleMiddleware(app, server);
    devVite = out.vite;
    app.use((req, res, next) => {
      if (req.method !== "GET" && req.method !== "HEAD") return next();
      const raw = (req.originalUrl ?? req.url ?? "").split("?")[0] ?? "";
      let pathname: string;
      try {
        pathname = decodeURIComponent(raw);
      } catch {
        pathname = raw;
      }
      const isModule = pathname.startsWith("/@vite") || pathname.startsWith("/@react-refresh") || pathname.includes("@vite") || pathname.startsWith("/src/") || pathname.startsWith("/node_modules/") || pathname.startsWith("/@id/");
      if (!isModule) return next();
      return out.moduleMiddleware(req, res, next);
    });
  }

  // CORS: allow configured origins (production). Same-origin or localhost in dev.
  // Host-based app variant for single deployment (admin / nrcs / marketing) — RBAC and isolation
  app.use((req: express.Request & { appVariant?: "admin" | "nrcs" | "marketing" }, _res, next) => {
    const host = getHostFromRequest(req);
    req.appVariant = getAppVariantFromHost(host);
    next();
  });

  const allowedOriginsRaw = process.env.ALLOWED_ORIGINS ?? process.env.VITE_APP_URL ?? "";
  const allowedOrigins = allowedOriginsRaw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  app.use((req, res, next) => {
    const origin = req.headers.origin as string | undefined;
    if (origin) {
      if (process.env.NODE_ENV !== "production") {
        res.setHeader("Access-Control-Allow-Origin", origin);
      } else if (allowedOrigins.length > 0 && allowedOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
      }
    }
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Organization-Id");
    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }
    next();
  });

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Health check (no auth) — for Vercel/monitoring: https://techivano.com/api/health
  app.get(["/api/health", "/health"], (_req, res) => {
    res.status(200).json({
      status: "ok",
      service: "techivano",
      timestamp: new Date().toISOString(),
    });
  });

  // E2E dev-login: sets real auth cookies for Playwright session injection.
  // Only registered when E2E credentials are present (CI / local dev, never production).
  if (process.env.E2E_AUTH_EMAIL && process.env.E2E_AUTH_PASSWORD) {
    const e2eEmail = process.env.E2E_AUTH_EMAIL;
    const e2ePassword = process.env.E2E_AUTH_PASSWORD;
    app.post("/api/dev-login", async (req, res) => {
      const email = e2eEmail;
      const password = e2ePassword;
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const supabaseUrl =
          process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
        const supabaseAnonKey =
          process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
        const sb = createClient(supabaseUrl, supabaseAnonKey);
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error || !data.session) {
          return res.status(401).json({ error: error?.message ?? "No session" });
        }
        const accessToken = data.session.access_token;

        // Decode JWT payload without signature verification.
        // Supabase migrated to new signing keys; HS256 verification may fail on
        // newly issued tokens. Since signInWithPassword already validated the
        // credentials, the token is trustworthy for this test-only endpoint.
        const parts = accessToken.split(".");
        if (parts.length !== 3) {
          return res.status(401).json({ error: "Malformed access token" });
        }
        const payload = JSON.parse(
          Buffer.from(parts[1], "base64url").toString("utf8")
        ) as { sub?: string; email?: string };
        if (!payload.sub) {
          return res.status(401).json({ error: "Token missing sub claim" });
        }

        const { getUserByEmail, getUserBySupabaseUserId, provisionUserFromSupabase, setUserSupabaseId } =
          await import("../db");

        let user = await getUserBySupabaseUserId(payload.sub);

        if (!user && payload.email) {
          const byEmail = await getUserByEmail(payload.email);
          if (byEmail) {
            const id = (byEmail as Record<string, unknown>).id as number;
            await setUserSupabaseId(id, payload.sub);
            user = (await getUserBySupabaseUserId(payload.sub)) ?? byEmail;
          }
        }

        if (!user) {
          user = (await provisionUserFromSupabase({ sub: payload.sub, email: payload.email })) ?? undefined;
        }

        if (!user) {
          return res.status(401).json({
            error: "App user not found and could not be provisioned",
            sub: payload.sub,
            email: payload.email,
          });
        }

        const { COOKIE_NAME, SESSION_COOKIE_NAME } = await import("@shared/const");
        const { getAuthSessionCookieOptions } = await import("./cookies");
        const { createUserSession } = await import("../db");
        const cookieOpts = getAuthSessionCookieOptions(req, { rememberMe: true });

        res.cookie(COOKIE_NAME, accessToken, cookieOpts);

        const supabaseUserId = (user as Record<string, unknown>).supabaseUserId;
        if (typeof supabaseUserId === "string") {
          try {
            const sessionId = await createUserSession({
              userId: supabaseUserId,
              userAgent: req.headers["user-agent"],
              ip: req.ip,
            });
            if (sessionId) {
              res.cookie(SESSION_COOKIE_NAME, sessionId, cookieOpts);
            }
          } catch {
            // user_sessions table may not exist yet; non-fatal for dev-login
          }
        }
        return res.json({ success: true });
      } catch (err) {
        return res.status(500).json({ error: (err as Error).message });
      }
    });
  }

  // Legacy Manus OAuth callback deprecated — redirect to app login (Supabase Auth)
  app.get("/api/oauth/callback", (_req, res) => {
    res.redirect(302, "/login");
  });
  
  // Magic link verification endpoint
  app.post("/api/auth/verify-magic-link", async (req, res) => {
    const { handleMagicLinkVerification } = await import("./magicLinkVerification");
    return handleMagicLinkVerification(req, res);
  });

  app.post("/warehouse/rebalance", async (req, res) => {
    const stockItemId = Number(req.body?.stockItemId);
    const tenantId = Number(req.headers["x-tenant-id"]);
    if (!Number.isInteger(stockItemId) || stockItemId <= 0) {
      return res.status(400).json({ error: "stockItemId must be a positive integer" });
    }
    if (!Number.isInteger(tenantId) || tenantId <= 0) {
      return res.status(400).json({ error: "x-tenant-id header is required" });
    }

    try {
      const user = await authenticateRequest(req);
      const queued = await enqueueWarehouseRebalanceJob({
        tenantId,
        requestedBy: user?.id ?? null,
        stockItemId,
      });
      return res.status(202).json({ queued: true, ...queued });
    } catch (error) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  });

  app.post("/api/uploads/signed-url", async (req, res) => {
    try {
      await authenticateRequest(req);
    } catch {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const body = req.body as {
      fileName?: unknown;
      fileType?: unknown;
      fileSize?: unknown;
      uploadType?: unknown;
    };

    const fileName = typeof body.fileName === "string" ? body.fileName : "";
    const fileType = typeof body.fileType === "string" ? body.fileType : "";
    const fileSize = Number(body.fileSize);
    const uploadType =
      typeof body.uploadType === "string" ? (body.uploadType as UploadCategory) : "assets";

    if (!fileName || !fileType || !Number.isFinite(fileSize)) {
      return res.status(400).json({
        error: "fileName, fileType and fileSize are required",
      });
    }

    const allowedCategories: UploadCategory[] = [
      "assets",
      "inspection-images",
      "documents",
      "ocr",
    ];
    if (!allowedCategories.includes(uploadType)) {
      return res.status(400).json({
        error: `uploadType must be one of: ${allowedCategories.join(", ")}`,
      });
    }

    try {
      validateUploadRequest({
        category: uploadType,
        fileType,
        fileSize,
      });
    } catch (error) {
      return res.status(400).json({
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

      return res.json({
        uploadUrl,
        fileKey,
        expiresInSeconds: getSignedUploadTtlSeconds(),
      });
    } catch (error) {
      console.error("Failed to create signed upload URL", error);
      return res.status(500).json({
        error: "Failed to create signed upload URL",
      });
    }
  });

  app.post("/api/uploads/complete", async (req, res) => {
    let user;
    try {
      user = await authenticateRequest(req);
    } catch {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const body = req.body as {
      fileKey?: unknown;
      fileType?: unknown;
      uploadType?: unknown;
      tenantId?: unknown;
      organizationId?: unknown;
    };
    const fileKey = typeof body.fileKey === "string" ? body.fileKey : "";
    const fileType = typeof body.fileType === "string" ? body.fileType : "";
    const uploadType =
      typeof body.uploadType === "string" ? (body.uploadType as UploadCategory) : "assets";

    if (!fileKey || !fileType) {
      return res.status(400).json({ error: "fileKey and fileType are required" });
    }

    const fileUrl = resolvePublicUrl(fileKey);

    let queuedForOcr = false;
    if ((uploadType === "documents" || uploadType === "ocr") && process.env.REDIS_URL) {
      const orgContext = getOrganizationIdFromRequest(req, body.organizationId ?? body.tenantId);
      const tid = orgContext.tenantId;
      if (tid != null && Number.isInteger(tid) && tid > 0) {
        try {
          const encryptionMeta = await getOcrQueueEncryptionMetadata({
            organizationId: orgContext.organizationId,
            fileKey,
          });
          await enqueueUploadedDocumentForOcr({
            tenantId: tid,
            tenant_id: tid,
            organizationId: orgContext.organizationId ?? undefined,
            encryptionKeyVersion: encryptionMeta.encryptionKeyVersion,
            encryptionAlgorithm: encryptionMeta.encryptionAlgorithm,
            requestedBy: user?.id ?? null,
            fileKey,
            fileType,
            fileUrl,
            uploadedAt: new Date().toISOString(),
          });
          queuedForOcr = true;
        } catch (error) {
          console.error("Failed to enqueue OCR upload job", error);
          return res.status(500).json({ error: "Failed to enqueue OCR job" });
        }
      }
    }

    return res.json({
      fileKey,
      fileUrl,
      queuedForOcr,
    });
  });

  app.post("/api/uploads/encrypted", async (req, res) => {
    let user: any;
    try {
      user = await authenticateRequest(req);
    } catch {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = Number(user?.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(403).json({ error: "Authenticated user is missing an internal id" });
    }

    const body = req.body as {
      fileName?: unknown;
      fileType?: unknown;
      fileSize?: unknown;
      base64Data?: unknown;
      uploadType?: unknown;
      organizationId?: unknown;
    };

    const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
    const fileType = typeof body.fileType === "string" ? body.fileType.trim() : "";
    const uploadType =
      typeof body.uploadType === "string" ? (body.uploadType as UploadCategory) : "documents";
    const orgContext = getOrganizationIdFromRequest(req, body.organizationId);
    const declaredFileSize = Number(body.fileSize);
    const base64Data = typeof body.base64Data === "string" ? body.base64Data : "";

    if (!orgContext.organizationId) {
      return res.status(400).json({ error: "organizationId or x-tenant-id header is required" });
    }
    if (!fileName || !fileType || !base64Data) {
      return res.status(400).json({ error: "fileName, fileType and base64Data are required" });
    }

    const allowedCategories: UploadCategory[] = ["assets", "inspection-images", "documents", "ocr"];
    if (!allowedCategories.includes(uploadType)) {
      return res.status(400).json({
        error: `uploadType must be one of: ${allowedCategories.join(", ")}`,
      });
    }

    let plaintextBytes: Buffer;
    try {
      plaintextBytes = parseBase64Payload(base64Data);
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Invalid base64Data payload",
      });
    }

    if (plaintextBytes.length === 0) {
      return res.status(400).json({ error: "base64Data is empty after decoding" });
    }
    if (Number.isFinite(declaredFileSize) && declaredFileSize > 0 && declaredFileSize !== plaintextBytes.length) {
      return res.status(400).json({ error: "fileSize does not match decoded payload length" });
    }

    try {
      validateUploadRequest({
        category: uploadType,
        fileType,
        fileSize: plaintextBytes.length,
      });
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Invalid encrypted upload payload",
      });
    }

    try {
      let keyRecord = (await getActiveOrganizationEncryptionKey(orgContext.organizationId)) as
        | { encryptedKey: string; keyVersion: number }
        | null;
      if (!keyRecord) {
        keyRecord = (await createInitialOrganizationEncryptionKey(orgContext.organizationId)) as
          | { encryptedKey: string; keyVersion: number }
          | null;
      }

      if (!keyRecord) {
        return res.status(500).json({ error: "Unable to resolve organization encryption key" });
      }

      const keyVersion = Number(keyRecord.keyVersion);
      if (!Number.isInteger(keyVersion) || keyVersion <= 0) {
        return res.status(500).json({ error: "Invalid organization encryption key metadata" });
      }

      const orgDataKey = decryptOrgDataKey(String(keyRecord.encryptedKey));
      const encryptedPayload = encryptBufferAesGcm(plaintextBytes, orgDataKey);
      const fileKey = buildFileKey(uploadType, fileName);

      await getR2Client().send(
        new PutObjectCommand({
          Bucket: getR2Config().bucketName,
          Key: fileKey,
          Body: encryptedPayload.ciphertext,
          ContentType: "application/octet-stream",
          Metadata: {
            algorithm: encryptedPayload.algorithm,
            key_version: String(keyVersion),
            is_encrypted: "true",
            original_content_type: fileType,
          },
        })
      );

      const fileUrl = resolvePublicUrl(fileKey);
      const document = (await createEncryptedDocumentMetadata({
        organizationId: orgContext.organizationId,
        uploadedBy: userId,
        fileName,
        fileKey,
        fileUrl,
        fileType: normalizeContentType(fileType),
        fileSize: plaintextBytes.length,
        encryption: {
          algorithm: encryptedPayload.algorithm,
          iv: encryptedPayload.iv.toString("base64"),
          authTag: encryptedPayload.authTag.toString("base64"),
          keyVersion,
          isEncrypted: true,
        },
      })) as { id: number } | null;

      if (!document) {
        return res.status(500).json({ error: "Failed to persist encrypted document metadata" });
      }

      return res.status(201).json({
        documentId: document.id,
        fileKey,
        downloadUrl: `/api/uploads/encrypted/${document.id}`,
      });
    } catch (error) {
      console.error("Encrypted upload failed", error);
      return res.status(500).json({ error: "Failed to upload encrypted file" });
    }
  });

  app.get("/api/uploads/encrypted/:documentId", async (req, res) => {
    try {
      await authenticateRequest(req);
    } catch {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const documentId = Number(req.params.documentId);
    const orgContext = getOrganizationIdFromRequest(req);
    if (!Number.isInteger(documentId) || documentId <= 0) {
      return res.status(400).json({ error: "documentId must be a positive integer" });
    }
    if (!orgContext.organizationId) {
      return res.status(400).json({ error: "organizationId or x-tenant-id header is required" });
    }

    try {
      const document = (await getDocumentById(documentId, {
        organizationId: orgContext.organizationId,
      })) as
        | {
            entityType: string | null;
            entityId: number | null;
            name: string;
            description: string | null;
            fileKey: string;
            fileType: string | null;
          organizationId: string | null;
          encryptionAlgorithm: string | null;
          encryptionIv: string | null;
          encryptionAuthTag: string | null;
          encryptionKeyVersion: number | null;
          isEncrypted: boolean;
          }
        | null;
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      let encryptionMeta:
        | { algorithm: string; iv: string; authTag: string; keyVersion: number; isEncrypted: boolean }
        | null = null;
      let originalFileName = document.name;
      if (
        document.isEncrypted &&
        document.encryptionAlgorithm &&
        document.encryptionIv &&
        document.encryptionAuthTag &&
        Number.isInteger(document.encryptionKeyVersion)
      ) {
        encryptionMeta = {
          algorithm: document.encryptionAlgorithm,
          iv: document.encryptionIv,
          authTag: document.encryptionAuthTag,
          keyVersion: Number(document.encryptionKeyVersion),
          isEncrypted: true,
        };
      } else if (document.description) {
        try {
          const parsed = JSON.parse(document.description);
          const meta = parsed?.encryption as {
            algorithm?: unknown;
            iv?: unknown;
            authTag?: unknown;
            keyVersion?: unknown;
            isEncrypted?: unknown;
          };
          if (
            meta &&
            typeof meta.algorithm === "string" &&
            typeof meta.iv === "string" &&
            typeof meta.authTag === "string" &&
            Number.isInteger(meta.keyVersion) &&
            meta.isEncrypted === true
          ) {
            encryptionMeta = {
              algorithm: meta.algorithm,
              iv: meta.iv,
              authTag: meta.authTag,
              keyVersion: Number(meta.keyVersion),
              isEncrypted: true,
            };
          }
          if (typeof parsed?.originalFileName === "string" && parsed.originalFileName) {
            originalFileName = parsed.originalFileName;
          }
        } catch {
          return res.status(500).json({ error: "Encrypted document metadata is invalid" });
        }
      }

      if (!encryptionMeta || encryptionMeta.algorithm !== "aes-256-gcm") {
        return res.status(500).json({ error: "Missing or unsupported encryption metadata" });
      }

      const keyRecord = (await getActiveOrganizationEncryptionKey(
        orgContext.organizationId,
        encryptionMeta.keyVersion
      )) as { encryptedKey: string } | null;
      if (!keyRecord) {
        return res.status(500).json({ error: "No encryption key found for this document" });
      }

      const objectResult = await getR2Client().send(
        new GetObjectCommand({
          Bucket: getR2Config().bucketName,
          Key: document.fileKey,
        })
      );
      const ciphertext = await s3BodyToBuffer(objectResult.Body);
      const dataKey = decryptOrgDataKey(String(keyRecord.encryptedKey));
      const plaintext = decryptBufferAesGcm(
        ciphertext,
        dataKey,
        Buffer.from(encryptionMeta.iv, "base64"),
        Buffer.from(encryptionMeta.authTag, "base64")
      );

      const fileType = document.fileType ? normalizeContentType(document.fileType) : "application/octet-stream";
      res.setHeader("Content-Type", fileType);
      res.setHeader("Content-Length", String(plaintext.length));
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${String(originalFileName || "download.bin").replace(/"/g, "")}"`
      );
      return res.status(200).send(plaintext);
    } catch (error) {
      console.error("Encrypted download failed", error);
      return res.status(500).json({ error: "Failed to download encrypted file" });
    }
  });

  app.post("/api/organizations/:organizationId/encryption-keys/rotate", async (req, res) => {
    let user: any;
    try {
      user = await authenticateRequest(req);
    } catch {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (user?.role !== "admin") {
      return res.status(403).json({ error: "Admin role required" });
    }

    const rawOrganizationId = req.params.organizationId;
    let normalizedOrganizationId: string;
    try {
      normalizedOrganizationId = normalizeOrganizationId(rawOrganizationId);
    } catch {
      return res.status(400).json({ error: "organizationId must be UUID or numeric tenant id" });
    }

    try {
      const result = await rotateOrganizationEncryptionKey(normalizedOrganizationId);
      return res.status(200).json({
        organizationId: result.organizationId,
        retiredVersion: result.retiredVersion,
        activeKeyVersion: result.activeKeyVersion,
        algorithm: "aes-256-gcm",
        rotatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Organization key rotation failed", error);
      return res.status(500).json({ error: "Failed to rotate organization key" });
    }
  });

  app.post("/api/uploads/multipart/start", async (req, res) => {
    try {
      await authenticateRequest(req);
    } catch {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const body = req.body as {
      fileName?: unknown;
      fileType?: unknown;
      fileSize?: unknown;
      uploadType?: unknown;
    };

    const fileName = typeof body.fileName === "string" ? body.fileName : "";
    const fileType = typeof body.fileType === "string" ? body.fileType : "";
    const fileSize = Number(body.fileSize);
    const uploadType =
      typeof body.uploadType === "string" ? (body.uploadType as UploadCategory) : "documents";

    if (!fileName || !fileType || !Number.isFinite(fileSize)) {
      return res.status(400).json({
        error: "fileName, fileType and fileSize are required",
      });
    }

    const allowedCategories: UploadCategory[] = [
      "assets",
      "inspection-images",
      "documents",
      "ocr",
    ];
    if (!allowedCategories.includes(uploadType)) {
      return res.status(400).json({
        error: `uploadType must be one of: ${allowedCategories.join(", ")}`,
      });
    }

    try {
      validateMultipartStartRequest({ fileType, fileSize });
    } catch (error) {
      return res.status(400).json({
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
        return res.status(500).json({ error: "Failed to initialize multipart upload" });
      }

      return res.json({
        uploadId: response.UploadId,
        fileKey,
        partSize: MULTIPART_PART_SIZE_BYTES,
        maxParts: MULTIPART_MAX_PARTS,
      });
    } catch (error) {
      console.error("Failed to start multipart upload", error);
      return res.status(500).json({ error: "Failed to start multipart upload" });
    }
  });

  app.post("/api/uploads/multipart/url", async (req, res) => {
    try {
      await authenticateRequest(req);
    } catch {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const body = req.body as {
      uploadId?: unknown;
      fileKey?: unknown;
      partNumber?: unknown;
      fileType?: unknown;
    };
    const uploadId = typeof body.uploadId === "string" ? body.uploadId : "";
    const fileKey = typeof body.fileKey === "string" ? body.fileKey : "";
    const partNumber = Number(body.partNumber);
    const fileType = typeof body.fileType === "string" ? body.fileType : "";

    if (!uploadId || !fileKey || !Number.isInteger(partNumber)) {
      return res.status(400).json({
        error: "uploadId, fileKey and partNumber are required",
      });
    }
    if (partNumber < 1 || partNumber > MULTIPART_MAX_PARTS) {
      return res.status(400).json({
        error: `partNumber must be between 1 and ${MULTIPART_MAX_PARTS}`,
      });
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

      return res.json({ uploadUrl });
    } catch (error) {
      console.error("Failed to generate multipart part URL", error);
      return res.status(500).json({ error: "Failed to generate multipart part URL" });
    }
  });

  app.post("/api/uploads/multipart/complete", async (req, res) => {
    let user;
    try {
      user = await authenticateRequest(req);
    } catch {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const body = req.body as {
      uploadId?: unknown;
      fileKey?: unknown;
      fileType?: unknown;
      fileSize?: unknown;
      uploadType?: unknown;
      organizationId?: unknown;
      parts?: unknown;
    };
    const uploadId = typeof body.uploadId === "string" ? body.uploadId : "";
    const fileKey = typeof body.fileKey === "string" ? body.fileKey : "";
    const fileType = typeof body.fileType === "string" ? body.fileType : "";
    const fileSize = Number(body.fileSize);
    const uploadType =
      typeof body.uploadType === "string" ? (body.uploadType as UploadCategory) : "documents";
    const orgContext = getOrganizationIdFromRequest(req, body.organizationId);
    const parts = Array.isArray(body.parts)
      ? body.parts
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
      return res.status(400).json({
        error: "uploadId, fileKey and parts are required",
      });
    }
    if (parts.length > MULTIPART_MAX_PARTS) {
      return res.status(400).json({
        error: `Maximum number of parts is ${MULTIPART_MAX_PARTS}`,
      });
    }

    const uniquePartNumbers = new Set(parts.map((part) => part.PartNumber));
    if (uniquePartNumbers.size !== parts.length) {
      return res.status(400).json({ error: "Duplicate partNumber values are not allowed" });
    }

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
          return res.status(400).json({
            error: `Part ${part.PartNumber} is missing or ETag does not match`,
          });
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
      const multipartTid = orgContext.tenantId;
      if (
        shouldQueueOcr &&
        process.env.REDIS_URL &&
        multipartTid != null &&
        Number.isInteger(multipartTid) &&
        multipartTid > 0
      ) {
        const encryptionMeta = await getOcrQueueEncryptionMetadata({
          organizationId: orgContext.organizationId,
          fileKey,
        });
        await enqueueUploadedDocumentForOcr({
          tenantId: multipartTid,
          tenant_id: multipartTid,
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
          const db = await import("../db");
          await db.createDocument({
            name: fileKey.split("/").pop() ?? fileKey,
            fileUrl,
            fileKey,
            fileType: normalizeContentType(fileType) || null,
            fileSize: Number.isFinite(fileSize) && fileSize > 0 ? fileSize : null,
            entityType: "organization",
            entityId: multipartTid != null && Number.isInteger(multipartTid) && multipartTid > 0 ? multipartTid : null,
            organizationId: orgContext.organizationId,
            uploadedBy: user.id,
          });
        } catch (error) {
          console.error("Failed to record multipart upload metadata", error);
        }
      }

      return res.json({
        fileKey,
        fileUrl,
        queuedForOcr,
      });
    } catch (error) {
      console.error("Failed to complete multipart upload", error);
      return res.status(500).json({ error: "Failed to complete multipart upload" });
    }
  });

  app.get("/warehouse/recommendations", async (req, res) => {
    const orgContext = getOrganizationIdFromRequest(req);
    const stockItemId = req.query.stockItemId ? Number(req.query.stockItemId) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 50;

    if (!orgContext.organizationId) {
      return res.status(400).json({ error: "organizationId or x-tenant-id header is required" });
    }
    const recTenantId = orgContext.tenantId;
    if (recTenantId == null || !Number.isInteger(recTenantId) || recTenantId <= 0) {
      return res.status(400).json({ error: "tenantId context is required for recommendations" });
    }
    if (stockItemId !== undefined && (!Number.isInteger(stockItemId) || stockItemId <= 0)) {
      return res.status(400).json({ error: "stockItemId must be a positive integer" });
    }
    if (!Number.isInteger(limit) || limit <= 0 || limit > 200) {
      return res.status(400).json({ error: "limit must be between 1 and 200" });
    }

    try {
      await authenticateRequest(req);
      const recommendations = await listWarehouseTransferRecommendations({
        tenantId: recTenantId,
        stockItemId,
        limit,
      });
      return res.json(recommendations);
    } catch (error) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  });

  // Rate limit tRPC (mitigates brute-force on auth procedures)
  const rateLimit = (await import("express-rate-limit")).default;
  const trpcLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).setHeader("Content-Type", "application/json").end(
        JSON.stringify({ error: "Too many requests; try again later." })
      );
    },
  });
  app.use("/api/trpc", trpcLimiter);

  // Custom Google OAuth (same handlers as Vercel api/auth/google* for local testing)
  try {
    const googleHandler = (await import("../../api/auth/google")).default;
    const googleCallbackHandler = (await import("../../api/auth/google/callback")).default;
    app.get("/api/auth/google", (req, res) => googleHandler(req as express.Request, res as express.Response));
    app.get("/api/auth/google/callback", async (req, res) => {
      try {
        await (googleCallbackHandler as (req: express.Request, res: express.Response) => Promise<void>)(req, res);
      } catch (err) {
        console.error("[api/auth/google/callback]", err);
        res.statusCode = 500;
        res.setHeader("Content-Type", "text/plain");
        res.end("OAuth callback error");
      }
    });
  } catch {
    // api/auth may be unavailable in some setups
  }

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Queue monitoring dashboard (disabled in E2E to avoid Redis)
  if (process.env.E2E !== "1") {
    const bullBoardAdapter = new ExpressAdapter();
    bullBoardAdapter.setBasePath("/admin/queues");
    createBullBoard({
      queues: [new BullMQAdapter(getBackgroundQueue())],
      serverAdapter: bullBoardAdapter,
    });
    app.use("/admin/queues", bullBoardAdapter.getRouter());
  }

  // API 404: any /api request not handled above
  app.use("/api", (_req, res) => {
    if (!res.headersSent) {
      res.status(404).setHeader("Content-Type", "application/json").end(JSON.stringify({ error: "Not found" }));
    }
  });

  // Serve SPA HTML only for exact app routes (never for /@vite/* or /src/*).
  const spaPaths = ["/", "/login", "/signup", "/forgot-password", "/reset-password", "/set-password", "/auth/callback", "/verify-magic-link", "/welcome"];
  if (process.env.NODE_ENV === "development") {
    const projectRoot = path.resolve(import.meta.dirname ?? process.cwd(), "..", "..");
    const clientIndex = path.join(projectRoot, "client", "index.html");
    const fallbackIndex = path.join(import.meta.dirname ?? projectRoot, "public", "index.html");
    let spaHtml: string | null = null;
    for (const p of [clientIndex, fallbackIndex]) {
      if (fs.existsSync(p)) {
        try {
          spaHtml = fs.readFileSync(p, "utf-8");
          break;
        } catch {
          //
        }
      }
    }
    if (spaHtml) {
      // Dev-only: inject @react-refresh + @vite/client so React hydrates. Never run in production.
      const withVite = spaHtml.replace(/<head>/i, "<head><script type=\"module\">import RefreshRuntime from \"/@react-refresh\";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script><script type=\"module\" src=\"/@vite/client\"></script>");
      app.use((req, res, next) => {
        if (req.method !== "GET" && req.method !== "HEAD") return next();
        const raw = (req.originalUrl ?? req.url ?? "").split("?")[0] ?? "";
        const pathname = raw ? decodeURIComponent(raw).replace(/%2F/g, "/") : "/";
        if (!spaPaths.includes(pathname)) return next();
        res.status(200).set({ "Content-Type": "text/html" }).end(withVite);
      });
    }
  }

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server, devVite);
  } else {
    serveStatic(app);
  }

  // Global error handler (for next(err) from routes)
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (res.headersSent) return;
    const status = (err as { status?: number })?.status ?? 500;
    const message = process.env.NODE_ENV === "production" ? "Internal server error" : (err instanceof Error ? err.message : String(err));
    const payload: { error: string; stack?: string } = { error: message };
    if (process.env.NODE_ENV !== "production" && err instanceof Error && err.stack) {
      payload.stack = err.stack;
    }
    res.status(status).setHeader("Content-Type", "application/json").end(JSON.stringify(payload));
  });

  const preferredPort = parseInt(process.env.PORT || "3000", 10);
  const startPort = Number.isNaN(preferredPort) ? 3000 : preferredPort;
  let port: number;
  if (process.env.PORT != null && String(process.env.PORT).trim() !== "") {
    if (!(await isPortAvailable(preferredPort))) {
      throw new Error(`Port ${preferredPort} is in use. Stop the process using it or unset PORT to auto-select.`);
    }
    port = preferredPort;
  } else {
    port = await findAvailablePort(startPort);
    if (port !== preferredPort) {
      console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
    }
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
