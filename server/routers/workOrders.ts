// @ts-nocheck — workOrders sub-router (HIGH-11)
import { z } from "zod";
import { router } from "../_core/trpc";
import { managerProcedure, viewerProcedure } from "./_shared";
import * as workOrdersDb from "../db/workorders";
import * as notificationHelper from "../notificationHelper";

export const workOrdersRouter = router({
  list: viewerProcedure
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
      return await workOrdersDb.getAllWorkOrders({
        ...input,
        organizationId: ctx.organizationId ?? undefined,
      });
    }),
  getById: viewerProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return await workOrdersDb.getWorkOrderById(input.id);
    }),
  getByAssetId: viewerProcedure
    .input(z.object({ assetId: z.number() }))
    .query(async ({ input }) => {
      const [workOrders, summary] = await Promise.all([
        workOrdersDb.getWorkOrdersByAssetId(input.assetId),
        workOrdersDb.getMaintenanceSummary(input.assetId),
      ]);
      return { workOrders, summary };
    }),
  create: managerProcedure
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
      const workOrder = await workOrdersDb.createWorkOrder({
        ...input,
        requestedBy: ctx.user.id,
        organizationId: ctx.organizationId ?? undefined,
      });
      await workOrdersDb.createAuditLog({
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
  update: managerProcedure
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
      const existingWorkOrder = await workOrdersDb.getWorkOrderById(id);
      await workOrdersDb.createAuditLog({
        userId: ctx.user.id,
        action: "update_work_order",
        entityType: "work_order",
        entityId: id,
        changes: JSON.stringify(data),
      });
      const result = await workOrdersDb.updateWorkOrder(id, data);
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
