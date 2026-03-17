// @ts-nocheck — maintenance sub-router (HIGH-11 audit follow-up)
import { z } from "zod";
import { router } from "../_core/trpc";
import { managerOrAdminProcedure, resolveTenantIdFromContext, viewerProcedure } from "./_shared";
import * as db from "../db";
import { enqueuePmEvaluationJob, enqueuePredictiveScoringJob } from "../jobs/queue";

export const maintenanceRouter = router({
  list: viewerProcedure
    .input(z.object({
      assetId: z.number().optional(),
      isActive: z.boolean().optional(),
    }).optional())
    .query(async ({ input, ctx }) => {
      return await db.getAllMaintenanceSchedules({ ...input, organizationId: ctx.organizationId ?? undefined });
    }),
  upcoming: viewerProcedure
    .input(z.object({ days: z.number().default(30) }))
    .query(async ({ input }) => {
      return await db.getUpcomingMaintenance(input.days);
    }),
  create: managerOrAdminProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      assetId: z.number(),
      frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "semi_annual", "annual"]),
      frequencyValue: z.number().default(1),
      nextDue: z.date(),
      assignedTo: z.number().optional(),
      taskTemplate: z.string().optional(),
      estimatedDuration: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const schedule = await db.createMaintenanceSchedule({ ...input, organizationId: ctx.organizationId ?? undefined });
      await db.createAuditLog({
        userId: ctx.user.id,
        action: "create_maintenance_schedule",
        entityType: "maintenance_schedule",
        entityId: schedule?.id,
      });
      return schedule;
    }),
  update: managerOrAdminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      description: z.string().optional(),
      frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "semi_annual", "annual"]).optional(),
      frequencyValue: z.number().optional(),
      lastPerformed: z.date().optional(),
      nextDue: z.date().optional(),
      assignedTo: z.number().optional(),
      isActive: z.boolean().optional(),
      taskTemplate: z.string().optional(),
      estimatedDuration: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      await db.createAuditLog({
        userId: ctx.user.id,
        action: "update_maintenance_schedule",
        entityType: "maintenance_schedule",
        entityId: id,
        changes: JSON.stringify(data),
      });
      return await db.updateMaintenanceSchedule(id, data);
    }),
  getPredictions: viewerProcedure.query(async () => {
    const { getAllMaintenancePredictions } = await import("../predictiveMaintenance");
    return await getAllMaintenancePredictions();
  }),
  getHighPriorityPredictions: viewerProcedure.query(async () => {
    const { getHighPriorityPredictions } = await import("../predictiveMaintenance");
    return await getHighPriorityPredictions();
  }),
  getAssetPrediction: viewerProcedure
    .input(z.object({ assetId: z.number() }))
    .query(async ({ input }) => {
      const { analyzeAssetMaintenancePattern } = await import("../predictiveMaintenance");
      return await analyzeAssetMaintenancePattern(input.assetId);
    }),
  autoCreateWorkOrders: managerOrAdminProcedure.mutation(async ({ ctx }) => {
    const tenantId = resolveTenantIdFromContext(ctx);
    const queued = await enqueuePmEvaluationJob({
      tenantId,
      requestedBy: ctx.user.id,
      actorUserId: ctx.user.id,
    });
    return { queued: true, ...queued };
  }),
  enqueuePredictiveScoring: managerOrAdminProcedure
    .input(z.object({ assetId: z.number().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      const tenantId = resolveTenantIdFromContext(ctx);
      const queued = await enqueuePredictiveScoringJob({
        tenantId,
        requestedBy: ctx.user.id,
        assetId: input?.assetId,
      });
      return { queued: true, ...queued };
    }),
});
