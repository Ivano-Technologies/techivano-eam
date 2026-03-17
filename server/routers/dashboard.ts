// @ts-nocheck — dashboard sub-router (HIGH-11 audit follow-up)
import { router } from "../_core/trpc";
import { viewerProcedure } from "./_shared";
import * as db from "../db";

export const dashboardRouter = router({
  stats: viewerProcedure.query(async () => {
    return await db.getDashboardStats();
  }),
});
