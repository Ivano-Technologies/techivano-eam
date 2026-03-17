/**
 * Tenant guardrail verification: tenant context and isolation behavior.
 * @see supabase/migrations/20260311130000_tenant_context_guardrail.sql
 * @see docs/TENANT_GUARDRAIL_VERIFICATION.md
 */
import { describe, it, expect } from "vitest";
import {
  runWithTenantContext,
  getTenantOrganizationId,
  getTenantId,
  setTenantContextOnConnection,
} from "../_core/tenantContext";
import {
  getOrganizationIdForGuardrail,
  getTenantIdForGuardrail,
} from "../_core/tenantResolver";
import type { TrpcContext } from "../_core/context";

describe("Tenant guardrail layer", () => {
  const mockCtx: TrpcContext = {
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
    user: null,
    tenantId: 1,
    organizationId: "00000000-0000-4000-8000-000000000001",
    membership: null,
  };

  describe("tenantResolver", () => {
    it("returns organizationId from context for guardrail", () => {
      expect(getOrganizationIdForGuardrail(mockCtx)).toBe(
        "00000000-0000-4000-8000-000000000001"
      );
    });
    it("returns tenantId from context", () => {
      expect(getTenantIdForGuardrail(mockCtx)).toBe(1);
    });
    it("returns null when organizationId is missing", () => {
      const ctxNoOrg: TrpcContext = { ...mockCtx, organizationId: null };
      expect(getOrganizationIdForGuardrail(ctxNoOrg)).toBeNull();
    });
  });

  describe("tenantContext (AsyncLocalStorage)", () => {
    it("runWithTenantContext sets storage visible to getTenantOrganizationId", () => {
      runWithTenantContext(
        {
          organizationId: "00000000-0000-4000-8000-000000000002",
          tenantId: 2,
        },
        () => {
          expect(getTenantOrganizationId()).toBe(
            "00000000-0000-4000-8000-000000000002"
          );
          expect(getTenantId()).toBe(2);
        }
      );
    });
    it("getTenantOrganizationId returns null outside runWithTenantContext", () => {
      expect(getTenantOrganizationId()).toBeNull();
      expect(getTenantId()).toBeNull();
    });
    it("nested runWithTenantContext uses inner context", () => {
      runWithTenantContext(
        { organizationId: "outer", tenantId: 1 },
        () => {
          expect(getTenantOrganizationId()).toBe("outer");
          runWithTenantContext(
            { organizationId: "inner", tenantId: 2 },
            () => {
              expect(getTenantOrganizationId()).toBe("inner");
              expect(getTenantId()).toBe(2);
            }
          );
          expect(getTenantOrganizationId()).toBe("outer");
        }
      );
    });
  });

  describe("setTenantContextOnConnection", () => {
    it("calls exec with set_config SQL and organizationId", async () => {
      const calls: { sql: string; params?: unknown[] }[] = [];
      const exec: (sql: string, params?: unknown[]) => Promise<unknown> = async (
        sql,
        params
      ) => {
        calls.push({ sql, params });
        return [];
      };
      await setTenantContextOnConnection(exec, "00000000-0000-4000-8000-000000000001");
      expect(calls).toHaveLength(1);
      expect(calls[0]?.sql).toContain("set_config");
      expect(calls[0]?.params).toEqual(["00000000-0000-4000-8000-000000000001"]);
    });
  });

  describe("cross-tenant isolation (behavior)", () => {
    it("tenant A context does not expose tenant B organizationId", () => {
      runWithTenantContext(
        { organizationId: "org-a", tenantId: 1 },
        () => {
          expect(getTenantOrganizationId()).toBe("org-a");
        }
      );
      runWithTenantContext(
        { organizationId: "org-b", tenantId: 2 },
        () => {
          expect(getTenantOrganizationId()).toBe("org-b");
        }
      );
    });
  });
});
