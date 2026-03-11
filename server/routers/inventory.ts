// @ts-nocheck — inventory sub-router (HIGH-11 audit follow-up)
import { z } from "zod";
import { router, protectedOrgProcedure } from "../_core/trpc";
import { adminProcedure, managerOrAdminProcedure } from "./_shared";
import * as db from "../db";

export const inventoryRouter = router({
  list: protectedOrgProcedure
    .input(z.object({ siteId: z.number().optional() }).optional())
    .query(async ({ input, ctx }) => {
      return await db.getAllInventoryItems(input?.siteId, ctx.organizationId ?? undefined);
    }),
  lowStock: protectedOrgProcedure
    .input(z.object({ siteId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      return await db.getLowStockItems(input?.siteId);
    }),
  transactions: protectedOrgProcedure
    .input(z.object({ itemId: z.number() }))
    .query(async ({ input }) => {
      return await db.getInventoryTransactions(input.itemId);
    }),
  create: managerOrAdminProcedure
    .input(z.object({
      itemCode: z.string().min(1),
      name: z.string().min(1),
      description: z.string().optional(),
      category: z.string().optional(),
      siteId: z.number(),
      currentStock: z.number().default(0),
      minStockLevel: z.number().default(0),
      reorderPoint: z.number().default(0),
      maxStockLevel: z.number().optional(),
      unitOfMeasure: z.string().optional(),
      unitCost: z.string().optional(),
      vendorId: z.number().optional(),
      location: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      return await db.createInventoryItem({ ...input, organizationId: ctx.organizationId ?? undefined });
    }),
  update: managerOrAdminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      description: z.string().optional(),
      category: z.string().optional(),
      currentStock: z.number().optional(),
      minStockLevel: z.number().optional(),
      reorderPoint: z.number().optional(),
      maxStockLevel: z.number().optional(),
      unitOfMeasure: z.string().optional(),
      unitCost: z.string().optional(),
      vendorId: z.number().optional(),
      location: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return await db.updateInventoryItem(id, data);
    }),
  addTransaction: protectedOrgProcedure
    .input(z.object({
      itemId: z.number(),
      type: z.enum(["in", "out", "adjustment", "transfer"]),
      quantity: z.number(),
      workOrderId: z.number().optional(),
      fromSiteId: z.number().optional(),
      toSiteId: z.number().optional(),
      unitCost: z.string().optional(),
      totalCost: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const transaction = await db.createInventoryTransaction({
        ...input,
        performedBy: ctx.user.id,
      });
      const item = await db.getAllInventoryItems(undefined, ctx.organizationId ?? undefined).then((items) => items.find((i) => i.id === input.itemId));
      if (item) {
        let newStock = item.currentStock;
        if (input.type === "in") newStock += input.quantity;
        else if (input.type === "out") newStock -= input.quantity;
        else if (input.type === "adjustment") newStock = input.quantity;
        await db.updateInventoryItem(input.itemId, { currentStock: newStock });
      }
      return transaction;
    }),
  bulkDelete: adminProcedure
    .input(z.object({ ids: z.array(z.number()) }))
    .mutation(async ({ input, ctx }) => {
      let deleted = 0;
      for (const id of input.ids) {
        try {
          await db.deleteInventoryItem(id);
          await db.createAuditLog({
            userId: ctx.user.id,
            action: "bulk_delete_inventory",
            entityType: "inventory",
            entityId: id,
          });
          deleted++;
        } catch (error) {
          console.error(`Failed to delete inventory item ${id}:`, error);
        }
      }
      return { deleted, total: input.ids.length };
    }),
});
