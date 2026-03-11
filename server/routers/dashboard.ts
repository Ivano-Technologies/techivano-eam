// @ts-nocheck — dashboard sub-router (HIGH-11 audit follow-up)
import { router, protectedOrgProcedure } from "../_core/trpc";
import * as db from "../db";

export const dashboardRouter = router({
  stats: protectedOrgProcedure.query(async () => {
    return await db.getDashboardStats();
  }),
});
