import jwt from "jsonwebtoken";
import { createServer } from "node:http";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

const TEST_SECRET = "test_supabase_jwt_secret_32_characters_minimum";

describe("auth hardening", () => {
  it("rejects missing, malformed, and expired JWTs", async () => {
    vi.resetModules();
    vi.doMock("../../server/_core/env", () => ({
      ENV: {
        supabaseUrl: "",
        supabaseJwtSecret: TEST_SECRET,
        supabaseJwtIssuer: undefined,
        supabaseJwtAudience: undefined,
      },
    }));
    const { verifySupabaseToken } = await import("../../server/_core/supabaseAuth");

    const missing = await verifySupabaseToken(undefined);
    const malformed = await verifySupabaseToken("not-a-jwt");
    const expired = await verifySupabaseToken(
      jwt.sign({ sub: "user-expired", email: "expired@techivano.test" }, TEST_SECRET, {
        algorithm: "HS256",
        expiresIn: -10,
      })
    );

    expect(missing).toBeNull();
    expect(malformed).toBeNull();
    expect(expired).toBeNull();
  });

  it("accepts valid JWT and preserves sub claim", async () => {
    vi.resetModules();
    vi.doMock("../../server/_core/env", () => ({
      ENV: {
        supabaseUrl: "",
        supabaseJwtSecret: TEST_SECRET,
        supabaseJwtIssuer: undefined,
        supabaseJwtAudience: undefined,
      },
    }));
    const { verifySupabaseToken } = await import("../../server/_core/supabaseAuth");

    const token = jwt.sign({ sub: "user-valid-1", email: "valid@techivano.test" }, TEST_SECRET, {
      algorithm: "HS256",
      expiresIn: "1h",
    });
    const payload = await verifySupabaseToken(token);
    expect(payload?.sub).toBe("user-valid-1");
  });

  it("enforces host-tenant isolation over spoofed tenant headers", async () => {
    vi.resetModules();
    vi.doMock("../../server/_core/env", () => ({
      ENV: {
        hostOrgNrcs: "00000000-0000-4000-8000-000000000123",
        hostOrgAdmin: null,
      },
      isGlobalOwnerEmail: () => false,
    }));
    const { resolveOrganizationContext } = await import("../../server/_core/context");

    const context = resolveOrganizationContext({
      req: {
        headers: {
          host: "techivano.com",
          "x-organization-id": "00000000-0000-4000-8000-000000009999",
        },
        query: {},
      } as never,
      user: null,
      explicitOrganizationId: undefined,
      explicitTenantId: undefined,
    });

    // Requests to the main host are pinned to configured org, ignoring spoofed headers.
    expect(context.organizationId).toBe("00000000-0000-4000-8000-000000000123");
    expect(context.tenantId).toBe(291);
  });

  it("protected API rejects invalid access and accepts valid session token", async () => {
    vi.resetModules();
    vi.doMock("../../server/_core/env", () => ({
      ENV: {
        supabaseUrl: "",
        supabaseJwtSecret: TEST_SECRET,
        supabaseJwtIssuer: undefined,
        supabaseJwtAudience: undefined,
      },
    }));
    process.env.NODE_ENV = "test";

    const { default: protectedHandler } = await import("../../api/test/protected");
    const server = createServer((req, res) => {
      void protectedHandler(req, res);
    });

    const missing = await request(server).get("/api/test/protected");
    expect(missing.status).toBe(401);

    const invalid = await request(server)
      .get("/api/test/protected")
      .set("Cookie", "app_session_id=not-a-valid-jwt");
    expect(invalid.status).toBe(401);

    const validToken = jwt.sign({ sub: "auth-user-1", email: "u@techivano.test" }, TEST_SECRET, {
      algorithm: "HS256",
      expiresIn: "1h",
    });
    const valid = await request(server)
      .get("/api/test/protected")
      .set("Cookie", `app_session_id=${validToken}`);
    expect(valid.status).toBe(200);
    expect(valid.body.success).toBe(true);
  });
});
