// @ts-nocheck — workOrders sub-router (HIGH-11)
import { z } from "zod";
import { router, protectedOrgProcedure } from "../_core/trpc";
import * as db from "../db";
import * as notificationHelper from "../notificationHelper";

export const workOrdersRouter = router({
  list: protectedOrgProcedure
    .input(
      z
        .object({
          siteId: z.number().optional(),
          status: z.string().optional(),
          assignedTo: z.number().optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      return await db.getAllWorkOrders({
        ...input,
        organizationId: ctx.organizationId ?? undefined,
      });
    }),
  getById: protectedOrgProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return await db.getWorkOrderById(input.id);
    }),
  getByAssetId: protectedOrgProcedure
    .input(z.object({ assetId: z.number() }))
    .query(async ({ input }) => {
      const [workOrders, summary] = await Promise.all([
        db.getWorkOrdersByAssetId(input.assetId),
        db.getMaintenanceSummary(input.assetId),
      ]);
      return { workOrders, summary };
    }),
  create: protectedOrgProcedure
    .input(
      z.object({
        workOrderNumber: z.string().min(1),
        title: z.string().min(1),
        description: z.string().optional(),
        assetId: z.number(),
        siteId: z.number(),
        type: z.enum(["corrective", "preventive", "inspection", "emergency"]),
        priority: z
          .enum(["low", "medium", "high", "critical"])
          .default("medium"),
        assignedTo: z.number().optional(),
        scheduledStart: z.date().optional(),
        scheduledEnd: z.date().optional(),
        estimatedCost: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const workOrder = await db.createWorkOrder({
        ...input,
        requestedBy: ctx.user.id,
        organizationId: ctx.organizationId ?? undefined,
      });
      await db.createAuditLog({
        userId: ctx.user.id,
        action: "create_work_order",
        entityType: "work_order",
        entityId: workOrder?.id,
      });
      if (input.assignedTo && workOrder?.id) {
        await notificationHelper.notifyWorkOrderAssigned(
          input.assignedTo,
          workOrder.id,
          input.title
        );
      }
      return workOrder;
    }),
  update: protectedOrgProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        status: z
          .enum([
            "pending",
            "assigned",
            "in_progress",
            "on_hold",
            "completed",
            "cancelled",
          ])
          .optional(),
        priority: z
          .enum(["low", "medium", "high", "critical"])
          .optional(),
        assignedTo: z.number().optional(),
        scheduledStart: z.date().optional(),
        scheduledEnd: z.date().optional(),
        actualStart: z.date().optional(),
        actualEnd: z.date().optional(),
        estimatedCost: z.string().optional(),
        actualCost: z.string().optional(),
        completionNotes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const existingWorkOrder = await db.getWorkOrderById(id);
      await db.createAuditLog({
        userId: ctx.user.id,
        action: "update_work_order",
        entityType: "work_order",
        entityId: id,
        changes: JSON.stringify(data),
      });
      const result = await db.updateWorkOrder(id, data);
      if (
        data.status === "completed" &&
        existingWorkOrder?.status !== "completed"
      ) {
        if (existingWorkOrder?.requestedBy) {
          await notificationHelper.notifyWorkOrderCompleted(
            existingWorkOrder.requestedBy,
            id,
            existingWorkOrder.title
          );
        }
      }
      if (
        data.assignedTo &&
        data.assignedTo !== existingWorkOrder?.assignedTo
      ) {
        await notificationHelper.notifyWorkOrderAssigned(
          data.assignedTo,
          id,
          existingWorkOrder?.title || "Work Order"
        );
      }
      return result;
    }),
});
