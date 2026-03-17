// @ts-nocheck — shared procedures for sub-routers (HIGH-11)
import { TRPCError } from "@trpc/server";
import { protectedOrgProcedure, requireRole, requireMFA } from "../_core/trpc";
import {
  analyticsService,
  complianceService,
  dispatchOptimizationService,
  executiveIntelligenceService,
  inspectionService,
  procurementService,
  slaService,
  supplyChainRiskService,
  stockIntelligenceService,
  vendorIntelligenceService,
  warehouseIntelligenceService,
} from "../modules";

/** Org-scoped: any org member (viewer and above). Use for read-only. */
export const viewerProcedure = protectedOrgProcedure.use(requireRole("viewer"));

/** Org-scoped: member role and above. */
export const memberProcedure = protectedOrgProcedure.use(requireRole("member"));

/** Org-scoped: manager role and above (create/update domain objects). */
export const managerProcedure = protectedOrgProcedure.use(requireRole("manager"));
export const managerOrAdminProcedure = managerProcedure;

/** Org-scoped: admin role and above (manage users, all resources). MFA required for global owners. */
export const orgAdminProcedure = protectedOrgProcedure.use(requireRole("admin")).use(requireMFA);
export const adminProcedure = orgAdminProcedure;

/** Org-scoped: owner only (full control, billing, delete org). MFA required for global owners. */
export const ownerProcedure = protectedOrgProcedure.use(requireRole("owner")).use(requireMFA);

export function resolveTenantIdFromContext(ctx: { tenantId: number | null; organizationId: string | null }) {
  void analyticsService;
  void complianceService;
  void dispatchOptimizationService;
  void executiveIntelligenceService;
  void inspectionService;
  void procurementService;
  void slaService;
  void supplyChainRiskService;
  void stockIntelligenceService;
  void vendorIntelligenceService;
  void warehouseIntelligenceService;
  if (!ctx.organizationId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Organization context is required",
    });
  }
  if (typeof ctx.tenantId === "number" && ctx.tenantId > 0) {
    return ctx.tenantId;
  }
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "Tenant ID is required for organization-scoped operations",
  });
}
