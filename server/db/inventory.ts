// @ts-nocheck — split from server/db.ts; schema uses pg-core; runtime Supabase Postgres
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

// ============= INVENTORY =============

export async function createInventoryItem(item: InsertInventoryItem) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(inventoryItems).values(item).returning({ id: inventoryItems.id });
  const insertId = result[0]?.id;
  if (!insertId || isNaN(Number(insertId))) throw new Error("Failed to get insert ID");
  return await db.select().from(inventoryItems).where(eq(inventoryItems.id, insertId)).limit(1).then(r => r[0]);
}

export async function getAllInventoryItems(siteId?: number, organizationId?: string | null) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (siteId) conditions.push(eq(inventoryItems.siteId, siteId));
  if (organizationId != null && organizationId !== "") {
    conditions.push(eq(inventoryItems.organizationId, normalizeOrganizationId(organizationId)));
  }
  if (conditions.length > 0) {
    return await db.select().from(inventoryItems).where(and(...conditions)).orderBy(asc(inventoryItems.name));
  }
  return await db.select().from(inventoryItems).orderBy(asc(inventoryItems.name));
}

export async function getLowStockItems(siteId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [sql`${inventoryItems.currentStock} <= ${inventoryItems.reorderPoint}`];
  if (siteId) conditions.push(eq(inventoryItems.siteId, siteId));
  
  return await db.select().from(inventoryItems)
    .where(and(...conditions))
    .orderBy(asc(inventoryItems.currentStock));
}

export async function updateInventoryItem(id: number, data: Partial<InsertInventoryItem>) {
  const db = await getDb();
  if (!db) return null;
  await db.update(inventoryItems).set(data).where(eq(inventoryItems.id, id));
  return await db.select().from(inventoryItems).where(eq(inventoryItems.id, id)).limit(1).then(r => r[0] || null);
}

export async function deleteInventoryItem(id: number) {
  const db = await getDb();
  if (!db) return false;
  await db.delete(inventoryItems).where(eq(inventoryItems.id, id));
  return true;
}



export async function createInventoryTransaction(transaction: typeof inventoryTransactions.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(inventoryTransactions).values(transaction).returning({ id: inventoryTransactions.id });
  const insertId = result[0]?.id;
  if (!insertId) throw new Error("Failed to get insert ID");
  return await db.select().from(inventoryTransactions).where(eq(inventoryTransactions.id, Number(insertId))).limit(1).then(r => r[0]);
}

export async function getInventoryTransactions(itemId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(inventoryTransactions)
    .where(eq(inventoryTransactions.itemId, itemId))
    .orderBy(desc(inventoryTransactions.transactionDate));
}

export async function getInventoryWarehouseMetrics(tenantId: number, stockItemId: number) {
  const db = await getDb();
  if (!db) return [];

  const itemRows = await db
    .select()
    .from(inventoryItems)
    .where(eq(inventoryItems.id, stockItemId))
    .limit(1);

  const item = itemRows[0];
  if (!item) return [];

  const sitesList = await db.select().from(sites).where(eq(sites.isActive, true));
  const siteAssetCounts = await db
    .select({
      siteId: assets.siteId,
      count: sql<number>`count(*)`,
    })
    .from(assets)
    .groupBy(assets.siteId);

  const siteBacklogCounts = await db
    .select({
      siteId: workOrders.siteId,
      count: sql<number>`count(*)`,
    })
    .from(workOrders)
    .where(
      and(
        eq(workOrders.status, "pending"),
        or(eq(workOrders.priority, "high"), eq(workOrders.priority, "critical")),
      ),
    )
    .groupBy(workOrders.siteId);

  const transferOutBySite = await db
    .select({
      siteId: inventoryTransactions.fromSiteId,
      quantity: sql<number>`coalesce(sum(${inventoryTransactions.quantity}), 0)`,
    })
    .from(inventoryTransactions)
    .where(
      and(
        eq(inventoryTransactions.itemId, stockItemId),
        eq(inventoryTransactions.type, "transfer"),
        isNotNull(inventoryTransactions.fromSiteId),
      ),
    )
    .groupBy(inventoryTransactions.fromSiteId);

  const transferInBySite = await db
    .select({
      siteId: inventoryTransactions.toSiteId,
      quantity: sql<number>`coalesce(sum(${inventoryTransactions.quantity}), 0)`,
    })
    .from(inventoryTransactions)
    .where(
      and(
        eq(inventoryTransactions.itemId, stockItemId),
        eq(inventoryTransactions.type, "transfer"),
        isNotNull(inventoryTransactions.toSiteId),
      ),
    )
    .groupBy(inventoryTransactions.toSiteId);

  const usageBySite = await db
    .select({
      siteId: inventoryTransactions.fromSiteId,
      quantity: sql<number>`coalesce(sum(${inventoryTransactions.quantity}), 0)`,
    })
    .from(inventoryTransactions)
    .where(
      and(
        eq(inventoryTransactions.itemId, stockItemId),
        eq(inventoryTransactions.type, "out"),
        isNotNull(inventoryTransactions.fromSiteId),
      ),
    )
    .groupBy(inventoryTransactions.fromSiteId);

  const assetMap = new Map(siteAssetCounts.map((row) => [row.siteId, Number(row.count)]));
  const backlogMap = new Map(siteBacklogCounts.map((row) => [row.siteId, Number(row.count)]));
  const transferOutMap = new Map(transferOutBySite.map((row) => [row.siteId, Number(row.quantity)]));
  const transferInMap = new Map(transferInBySite.map((row) => [row.siteId, Number(row.quantity)]));
  const usageMap = new Map(usageBySite.map((row) => [row.siteId, Number(row.quantity)]));

  // This system currently stores inventory item stock by site row.
  // Fallback to each site with neutral stock if item is site-specific.
  const itemRowsBySite = await db
    .select()
    .from(inventoryItems)
    .where(eq(inventoryItems.itemCode, item.itemCode));
  const stockBySite = new Map(itemRowsBySite.map((row) => [row.siteId, row]));

  return sitesList.map((site) => {
    const siteStockRow = stockBySite.get(site.id);
    const currentStock = siteStockRow?.currentStock ?? 0;
    const minStockLevel = siteStockRow?.minStockLevel ?? item.minStockLevel;
    const reorderPoint = siteStockRow?.reorderPoint ?? item.reorderPoint;
    const netTransfer = (transferInMap.get(site.id) ?? 0) - (transferOutMap.get(site.id) ?? 0);
    return {
      tenantId,
      stockItemId,
      warehouseId: site.id,
      warehouseName: site.name,
      currentStock,
      minStockLevel,
      reorderPoint,
      backlogCount: backlogMap.get(site.id) ?? 0,
      assetDensity: assetMap.get(site.id) ?? 0,
      recentUsage: usageMap.get(site.id) ?? 0,
      netTransfer,
    };
  });
}

export async function upsertWarehouseTransferRecommendations(params: {
  tenantId: number;
  recommendations: Array<{
    stockItemId: number;
    sourceWarehouseId: number;
    targetWarehouseId: number;
    transferQuantity: number;
    transferPriority: "balanced" | "moderate" | "urgent" | "critical";
    pressureScore: number;
    agentExecutionId: string;
  }>;
}) {
  const db = await getDb();
  if (!db || params.recommendations.length === 0) {
    return 0;
  }

  for (const reco of params.recommendations) {
    await db
      .insert(warehouseTransferRecommendations)
      .values({
        tenantId: params.tenantId,
        stockItemId: reco.stockItemId,
        sourceWarehouseId: reco.sourceWarehouseId,
        targetWarehouseId: reco.targetWarehouseId,
        transferQuantity: reco.transferQuantity,
        transferPriority: reco.transferPriority,
        pressureScore: reco.pressureScore.toFixed(4),
        agentExecutionId: reco.agentExecutionId,
      })
      .onConflictDoUpdate({
        target: [
          warehouseTransferRecommendations.tenantId,
          warehouseTransferRecommendations.stockItemId,
          warehouseTransferRecommendations.sourceWarehouseId,
          warehouseTransferRecommendations.targetWarehouseId,
          warehouseTransferRecommendations.agentExecutionId,
        ],
        set: {
          transferQuantity: reco.transferQuantity,
          transferPriority: reco.transferPriority,
          pressureScore: reco.pressureScore.toFixed(4),
        },
      });
  }

  return params.recommendations.length;
}

export async function listWarehouseTransferRecommendations(params: {
  tenantId: number;
  stockItemId?: number;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(warehouseTransferRecommendations.tenantId, params.tenantId)];
  if (params.stockItemId) {
    conditions.push(eq(warehouseTransferRecommendations.stockItemId, params.stockItemId));
  }

  return db
    .select()
    .from(warehouseTransferRecommendations)
    .where(and(...conditions))
    .orderBy(desc(warehouseTransferRecommendations.createdAt))
    .limit(params.limit ?? 50);
}