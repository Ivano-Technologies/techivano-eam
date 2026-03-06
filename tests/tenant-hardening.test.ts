import { describe, expect, it } from "vitest";
import {
  ensureTenantMatch,
  resolveTenantId,
} from "@/lib/tenant/context";
import { OCRJobPayloadSchema } from "@/lib/jobs/ocr-processing-queue";

describe("Sprint 6.5 tenant hardening", () => {
  it("uses tenant_id first as canonical tenant", () => {
    const tenantId = resolveTenantId("user-a", {
      tenant_id: "11111111-1111-4111-8111-111111111111",
      business_id: "22222222-2222-4222-8222-222222222222",
    });
    expect(tenantId).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("falls back to business_id when tenant_id missing", () => {
    const tenantId = resolveTenantId("user-a", {
      business_id: "22222222-2222-4222-8222-222222222222",
    });
    expect(tenantId).toBe("22222222-2222-4222-8222-222222222222");
  });

  it("throws when requested tenant differs from auth tenant", () => {
    expect(() =>
      ensureTenantMatch("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", {
        tenant_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      }),
    ).toThrow(/Tenant mismatch/);
  });

  it("accepts OCR payload with tenantId contract", () => {
    const result = OCRJobPayloadSchema.parse({
      receipt_id: "7d7b3d6f-208b-4fd5-8a91-1592928ad0d5",
      business_id: "6ad3ebf0-3538-4af1-8468-38edcae5fb15",
      tenant_id: "6ad3ebf0-3538-4af1-8468-38edcae5fb15",
      image_url: "https://example.com/r.jpg",
      idempotency_key: "k-1",
    });
    expect(result.tenant_id).toBe(result.business_id);
  });
});
