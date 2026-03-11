// @ts-nocheck — shared procedures for sub-routers (HIGH-11)
import { TRPCError } from "@trpc/server";
import { protectedOrgProcedure } from "../_core/trpc";
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

export const adminProcedure = protectedOrgProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

export const managerOrAdminProcedure = protectedOrgProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "manager") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Manager or Admin access required" });
  }
  return next({ ctx });
});

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
