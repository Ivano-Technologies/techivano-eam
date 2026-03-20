import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import verifyMagicLinkHandler from "../../api/auth/verify-magic-link";
import googleCallbackHandler from "../../api/auth/google/callback";
import uploadSignedUrlHandler from "../../api/uploads/signed-url";
import uploadCompleteHandler from "../../api/uploads/complete";
import uploadMultipartStartHandler from "../../api/uploads/multipart/start";
import uploadMultipartPartHandler from "../../api/uploads/multipart/part";
import uploadMultipartUrlHandler from "../../api/uploads/multipart/url";
import uploadMultipartCompleteHandler from "../../api/uploads/multipart/complete";

const verifyMagicLinkAndCreateSupabaseLinkMock = vi.hoisted(() => vi.fn());
const authenticateRequestMock = vi.hoisted(() => vi.fn());
const createClientMock = vi.hoisted(() => vi.fn());
const getSignedUrlMock = vi.hoisted(() => vi.fn());
const r2SendMock = vi.hoisted(() => vi.fn());

vi.mock("../../server/_core/magicLinkVerificationService", () => ({
  verifyMagicLinkAndCreateSupabaseLink: verifyMagicLinkAndCreateSupabaseLinkMock,
}));

vi.mock("../../server/_core/authenticateRequest", () => ({
  authenticateRequest: authenticateRequestMock,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: getSignedUrlMock,
}));

vi.mock("../../server/_core/r2", () => ({
  buildFileKey: vi.fn(() => "assets/2026/03/test-file.png"),
  getR2Config: vi.fn(() => ({ bucketName: "test-bucket" })),
  getR2Client: vi.fn(() => ({ send: r2SendMock }) as object),
  getSignedUploadTtlSeconds: vi.fn(() => 300),
  validateUploadRequest: vi.fn(),
  validateMultipartStartRequest: vi.fn(),
  normalizeContentType: vi.fn((v: string) => v),
  MULTIPART_PART_SIZE_BYTES: 8 * 1024 * 1024,
  MULTIPART_MAX_PARTS: 1000,
  resolvePublicUrl: vi.fn((key: string) => `https://cdn.example.com/${key}`),
}));

vi.mock("../../server/_core/context", () => ({
  resolveOrganizationContext: vi.fn(() => ({ organizationId: null, tenantId: null })),
}));

vi.mock("../../server/jobs/ocrUploadQueue", () => ({
  enqueueUploadedDocumentForOcr: vi.fn(),
}));

vi.mock("../../server/db", () => ({
  createDocument: vi.fn(),
  getDocumentByFileKey: vi.fn().mockResolvedValue(null),
}));

function createHandlerApp(
  path: string,
  handler: (req: express.Request, res: express.Response) => Promise<void> | void
) {
  const app = express();
  app.all(path, (req, res) => {
    void handler(req, res);
  });
  return app;
}

describe("serverless API route coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    r2SendMock.mockReset();
  });

  it("verifies magic link through serverless route", async () => {
    verifyMagicLinkAndCreateSupabaseLinkMock.mockResolvedValue({
      success: true,
      redirectTo: "https://example.supabase.co/auth/v1/verify?token=abc",
    });
    const app = createHandlerApp("/api/auth/verify-magic-link", verifyMagicLinkHandler as never);
    const response = await request(app)
      .post("/api/auth/verify-magic-link")
      .set("content-type", "application/json")
      .send(JSON.stringify({ token: "token-123" }));

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.redirectTo).toContain("supabase.co");
  });

  it("returns 400 when magic link token is missing", async () => {
    verifyMagicLinkAndCreateSupabaseLinkMock.mockResolvedValue({
      success: false,
      message: "Missing verification token",
    });
    const app = createHandlerApp("/api/auth/verify-magic-link", verifyMagicLinkHandler as never);
    const response = await request(app)
      .post("/api/auth/verify-magic-link")
      .set("content-type", "application/json")
      .send(JSON.stringify({}));

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      message: "Missing verification token",
    });
  });

  it("oauth callback sets HttpOnly cookies and does not leak tokens in URL", async () => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = "google-client-id";
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = "google-client-secret";
    process.env.SUPABASE_URL = "https://supabase.example.com";
    process.env.SUPABASE_ANON_KEY = "supabase-anon";
    process.env.NODE_ENV = "production";

    const fetchMock = vi.fn();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id_token: "google-id-token" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    createClientMock.mockReturnValue({
      auth: {
        signInWithIdToken: vi.fn().mockResolvedValue({
          data: {
            session: {
              access_token: "supabase-access-token",
              refresh_token: "supabase-refresh-token",
            },
          },
          error: null,
        }),
      },
    });

    const state = Buffer.from(
      JSON.stringify({ remember: "1", origin: "https://techivano.com" }),
      "utf8"
    ).toString("base64url");

    const app = createHandlerApp("/api/auth/google/callback", googleCallbackHandler as never);
    const response = await request(app)
      .get(`/api/auth/google/callback?code=test-code&state=${state}`)
      .set("x-forwarded-host", "techivano.com")
      .set("x-forwarded-proto", "https");

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("https://techivano.com/");
    expect(response.headers.location).not.toMatch(/access_token=|refresh_token=|id_token=/i);
    const cookies = response.headers["set-cookie"] as string[];
    expect(Array.isArray(cookies)).toBe(true);
    expect(cookies.some((cookie) => cookie.includes("HttpOnly"))).toBe(true);
    expect(cookies.some((cookie) => cookie.includes("SameSite=Lax"))).toBe(true);
    expect(cookies.some((cookie) => cookie.includes("Secure"))).toBe(true);
  });

  it("throws when test-only oauth mock code is attempted in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.ENABLE_TEST_AUTH = "false";
    process.env.OAUTH_E2E_MOCK = "1";

    const state = Buffer.from(
      JSON.stringify({ remember: "1", origin: "https://techivano.com" }),
      "utf8"
    ).toString("base64url");

    const req = {
      method: "GET",
      url: `/api/auth/google/callback?code=e2e-oauth-success&state=${state}`,
      headers: {
        host: "techivano.com",
        "x-forwarded-host": "techivano.com",
        "x-forwarded-proto": "https",
      },
    } as never;
    const res = {
      setHeader: vi.fn(),
      writeHead: vi.fn(),
      end: vi.fn(),
    } as never;

    await expect(googleCallbackHandler(req, res)).rejects.toThrow(
      "Test-only OAuth mock path attempted in production"
    );
  });

  it("serverless upload signed-url route returns signed upload payload", async () => {
    authenticateRequestMock.mockResolvedValue({ id: 1 });
    getSignedUrlMock.mockResolvedValue("https://signed.example.com/upload");

    const app = createHandlerApp("/api/uploads/signed-url", uploadSignedUrlHandler as never);
    const response = await request(app)
      .post("/api/uploads/signed-url")
      .set("content-type", "application/json")
      .send(
        JSON.stringify({
          fileName: "asset.png",
          fileType: "image/png",
          fileSize: 1024,
          uploadType: "assets",
        })
      );

    expect(response.status).toBe(200);
    expect(response.body.uploadUrl).toContain("signed.example.com");
    expect(response.body.fileKey).toContain("assets/");
  });

  it("serverless upload complete route returns public file URL", async () => {
    authenticateRequestMock.mockResolvedValue({ id: 1 });

    const app = createHandlerApp("/api/uploads/complete", uploadCompleteHandler as never);
    const response = await request(app)
      .post("/api/uploads/complete")
      .set("content-type", "application/json")
      .send(
        JSON.stringify({
          fileKey: "assets/2026/03/test-file.png",
          fileType: "image/png",
          uploadType: "assets",
        })
      );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      fileKey: "assets/2026/03/test-file.png",
      fileUrl: "https://cdn.example.com/assets/2026/03/test-file.png",
      queuedForOcr: false,
    });
  });

  it("multipart start -> part/url -> complete succeeds", async () => {
    authenticateRequestMock.mockResolvedValue({ id: 1 });
    getSignedUrlMock.mockResolvedValue("https://signed.example.com/upload-part");
    r2SendMock.mockImplementation((command: { constructor: { name: string } }) => {
      if (command.constructor.name === "CreateMultipartUploadCommand") {
        return Promise.resolve({ UploadId: "upload-123" });
      }
      if (command.constructor.name === "ListPartsCommand") {
        return Promise.resolve({
          Parts: [{ PartNumber: 1, ETag: '"etag-1"' }],
        });
      }
      if (command.constructor.name === "CompleteMultipartUploadCommand") {
        return Promise.resolve({});
      }
      return Promise.resolve({});
    });

    const startApp = createHandlerApp("/api/uploads/multipart/start", uploadMultipartStartHandler as never);
    const startRes = await request(startApp)
      .post("/api/uploads/multipart/start")
      .set("content-type", "application/json")
      .send(
        JSON.stringify({
          fileName: "large.pdf",
          fileType: "application/pdf",
          fileSize: 1000000,
          uploadType: "documents",
        })
      );
    expect(startRes.status).toBe(200);
    expect(startRes.body.uploadId).toBe("upload-123");
    expect(startRes.body.fileKey).toContain("assets/");

    const partApp = createHandlerApp("/api/uploads/multipart/part", uploadMultipartPartHandler as never);
    const partRes = await request(partApp)
      .post("/api/uploads/multipart/part")
      .set("content-type", "application/json")
      .send(
        JSON.stringify({
          uploadId: "upload-123",
          fileKey: "assets/2026/03/test-file.png",
          partNumber: 1,
          fileType: "application/pdf",
        })
      );
    expect(partRes.status).toBe(200);
    expect(partRes.body.uploadUrl).toContain("signed.example.com");

    const urlApp = createHandlerApp("/api/uploads/multipart/url", uploadMultipartUrlHandler as never);
    const urlRes = await request(urlApp)
      .post("/api/uploads/multipart/url")
      .set("content-type", "application/json")
      .send(
        JSON.stringify({
          uploadId: "upload-123",
          fileKey: "assets/2026/03/test-file.png",
          partNumber: 1,
          fileType: "application/pdf",
        })
      );
    expect(urlRes.status).toBe(200);
    expect(urlRes.body.uploadUrl).toContain("signed.example.com");

    const completeApp = createHandlerApp(
      "/api/uploads/multipart/complete",
      uploadMultipartCompleteHandler as never
    );
    const completeRes = await request(completeApp)
      .post("/api/uploads/multipart/complete")
      .set("content-type", "application/json")
      .send(
        JSON.stringify({
          uploadId: "upload-123",
          fileKey: "assets/2026/03/test-file.png",
          fileType: "application/pdf",
          fileSize: 1000000,
          uploadType: "documents",
          parts: [{ partNumber: 1, eTag: "etag-1" }],
        })
      );
    expect(completeRes.status).toBe(200);
    expect(completeRes.body.fileUrl).toBe("https://cdn.example.com/assets/2026/03/test-file.png");
  });

  it("multipart complete returns 400 when part ETag mismatches", async () => {
    authenticateRequestMock.mockResolvedValue({ id: 1 });
    r2SendMock.mockImplementation((command: { constructor: { name: string } }) => {
      if (command.constructor.name === "ListPartsCommand") {
        return Promise.resolve({
          Parts: [{ PartNumber: 1, ETag: '"etag-expected"' }],
        });
      }
      return Promise.resolve({});
    });

    const completeApp = createHandlerApp(
      "/api/uploads/multipart/complete",
      uploadMultipartCompleteHandler as never
    );
    const completeRes = await request(completeApp)
      .post("/api/uploads/multipart/complete")
      .set("content-type", "application/json")
      .send(
        JSON.stringify({
          uploadId: "upload-123",
          fileKey: "assets/2026/03/test-file.png",
          fileType: "application/pdf",
          fileSize: 1000000,
          uploadType: "documents",
          parts: [{ partNumber: 1, eTag: "etag-wrong" }],
        })
      );

    expect(completeRes.status).toBe(400);
    expect(String(completeRes.body.error)).toContain("ETag");
  });
});
