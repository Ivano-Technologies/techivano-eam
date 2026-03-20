import { systemRouter } from "../_core/systemRouter";
import { authRouter } from "./auth";
import { adminImpersonationRouter } from "./adminImpersonation";
import { sessionsRouter } from "./sessions";
import { sitesRouter } from "./sites";
import { assetCategoriesRouter } from "./assetCategories";
import { nrcsRouter } from "./nrcs";
import { assetsRouter } from "./assets";
import { workOrdersRouter } from "./workOrders";
import { maintenanceRouter } from "./maintenance";
import { inventoryRouter } from "./inventory";
import { warehouseRouter } from "./warehouse";
import { dashboardRouter } from "./dashboard";
import { usersRouter } from "./users";

/**
 * Shared top-level router composition for domain routers.
 * Keep this map free of business logic to avoid router.ts bloat.
 */
export const modularRouters = {
  system: systemRouter,
  auth: authRouter,
  impersonation: adminImpersonationRouter,
  sessions: sessionsRouter,
  sites: sitesRouter,
  assetCategories: assetCategoriesRouter,
  nrcs: nrcsRouter,
  assets: assetsRouter,
  workOrders: workOrdersRouter,
  maintenance: maintenanceRouter,
  inventory: inventoryRouter,
  warehouse: warehouseRouter,
  dashboard: dashboardRouter,
  users: usersRouter,
} as const;
