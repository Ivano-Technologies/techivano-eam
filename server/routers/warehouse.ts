import { z } from "zod";
import { router } from "../_core/trpc";
import { viewerProcedure } from "./_shared";
import * as warehouseService from "../services/warehouseService";

export const warehouseRouter = router({
  inventory: viewerProcedure.query(async ({ ctx }) => {
    return warehouseService.getInventoryLevels(ctx.organizationId ?? undefined);
  }),

  lowStock: viewerProcedure
    .input(
      z
        .object({
          siteId: z.number().int().positive().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return warehouseService.getLowStockItems(ctx.organizationId ?? undefined, input?.siteId);
    }),

  trends: viewerProcedure
    .input(
      z
        .object({
          days: z.number().int().min(1).max(365).optional(),
          siteId: z.number().int().positive().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return warehouseService.getConsumptionTrends({
        organizationId: ctx.organizationId ?? undefined,
        days: input?.days ?? 30,
        siteId: input?.siteId,
      });
    }),
});
