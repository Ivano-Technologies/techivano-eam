/**
 * One-time helper: splits server/db.ts into server/db/*.ts modules.
 * Run from repo root: node scripts/split-db.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const srcPath = path.join(root, "server", "db.ts");
const lines = fs.readFileSync(srcPath, "utf8").split(/\n/);

function sliceRanges(ranges) {
  const chunks = [];
  for (const [a, b] of ranges) {
    chunks.push(lines.slice(a - 1, b).join("\n"));
  }
  return chunks.join("\n\n");
}

const sharedImport = `// @ts-nocheck — split from server/db.ts; schema uses pg-core; runtime Supabase Postgres
import { eq, and, desc, asc, gte, lte, sql, or, like, isNotNull, isNull } from "drizzle-orm";
import {
  InsertUser, users, sites, InsertSite, assetCategories, assets, InsertAsset,
  workOrders, InsertWorkOrder, maintenanceSchedules, InsertMaintenanceSchedule,
  inventoryItems, InsertInventoryItem, inventoryTransactions, vendors, InsertVendor,
  financialTransactions, complianceRecords, auditLogs, documents,
  notifications, notificationPreferences, assetPhotos, InsertAssetPhoto,
  scheduledReports, InsertScheduledReport, assetTransfers, quickbooksConfig, InsertQuickBooksConfig,
  userPreferences, InsertUserPreferences, emailNotifications, InsertEmailNotification,
  workOrderTemplates, InsertWorkOrderTemplate, branchCodes, categoryCodes, subCategories,
  assetEditHistory, telemetryPoints, telemetryAggregates, reportSnapshots, predictiveScores,
  warehouseTransferRecommendations, vendorPerformanceMetrics, vendorRiskScores,
  procurementRecommendations, purchaseOrders, supplyChainRiskScores, supplyChainRiskEvents,
  fleetUnits, technicians, dispatchAssignments, executiveMetricsSnapshots, operationalKpiTrends,
  userSessions,
} from "./tables";
import { ENV } from "../_core/env";
import { logger } from "../_core/logger";
import { decryptOrgDataKey, encryptOrgDataKey, generateOrgDataKey } from "../_core/encryption";
import { getDb, getRootDb, normalizeOrganizationId } from "./core";
`;

const coreContent = `// @ts-nocheck — DB connection and tenant context
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { ENV } from "../_core/env";
import { logger } from "../_core/logger";
import { getPostgresClient } from "../_core/dbPool";
import { AsyncLocalStorage } from "node:async_hooks";

${sliceRanges([[1, 83], [1783, 1799]])}
`;

const files = {
  "server/db/core.ts": coreContent,
  "server/db/sites.ts": `${sharedImport}\n${sliceRanges([[194, 225], [459, 464]])}`,
  "server/db/users.ts": `${sharedImport}\n${sliceRanges([[85, 192], [2225, 2256], [2448, 2681], [3072, 3143]])}`,
  "server/db/assets.ts": `${sharedImport}\n${sliceRanges([
    [227, 308],
    [2149, 2177],
    [2259, 2265],
    [2317, 2371],
    [2363, 2370],
    [2373, 2379],
    [2742, 2762],
    [2898, 2904],
    [2914, 3050],
  ])}`,
  "server/db/workorders.ts": `${sharedImport}\n${sliceRanges([[310, 405], [2268, 2315], [2683, 2740]])}`,
  "server/db/inventory.ts": `${sharedImport}\n${sliceRanges([[407, 458], [465, 668]])}`,
  "server/db/vendors.ts": `${sharedImport}\n${sliceRanges([[670, 1586], [2906, 2912]])}`,
  "server/db/platform.ts": `${sharedImport}\n${sliceRanges([
    [1588, 1718],
    [1720, 1781],
    [1801, 2148],
    [2179, 2222],
    [2382, 2395],
    [2398, 2445],
    [2764, 2789],
  ])}`,
  "server/db/analytics.ts": `${sharedImport}\n${sliceRanges([[2792, 2896], [3145, 3370]])}`,
};

for (const [rel, body] of Object.entries(files)) {
  const out = path.join(root, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, body, "utf8");
  console.log("wrote", rel, body.split("\n").length, "lines");
}
