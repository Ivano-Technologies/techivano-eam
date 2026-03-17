// @ts-nocheck — asset categories sub-router (HIGH-11 audit follow-up)
import { z } from "zod";
import { router } from "../_core/trpc";
import { managerOrAdminProcedure, viewerProcedure } from "./_shared";
import * as db from "../db";

export const assetCategoriesRouter = router({
  list: viewerProcedure.query(async () => {
    return await db.getAllAssetCategories();
  }),
  create: managerOrAdminProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return await db.createAssetCategory(input.name, input.description);
    }),
});
