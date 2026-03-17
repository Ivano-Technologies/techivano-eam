// @ts-nocheck — schema uses pg-core; runtime uses Supabase Postgres via postgres-js and request-scoped tenant injection
import { eq, and, desc, asc, gte, lte, sql, or, like, isNotNull, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
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
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { logger } from "./_core/logger";
import { getPostgresClient } from "./_core/dbPool";
import { decryptOrgDataKey, encryptOrgDataKey, generateOrgDataKey } from "./_core/encryption";
import { AsyncLocalStorage } from "node:async_hooks";

let _db: PostgresJsDatabase | null = null;

/** Request-scoped Drizzle tx when running inside runWithTenantDb (for RLS). */
const tenantDbStorage = new AsyncLocalStorage<{ tx: PostgresJsDatabase }>();

/** Root DB (no tenant context). Use for auth, background jobs, and schema checks. */
export function getRootDb(): PostgresJsDatabase | null {
  if (!_db && ENV.databaseUrl) {
    try {
      const client = getPostgresClient();
      if (client) _db = drizzle(client) as PostgresJsDatabase;
    } catch (error) {
      logger.warn("Database connection initialization failed", {
        errorType: error instanceof Error ? error.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      _db = null;
    }
  }
  return _db;
}

/**
 * Run fn inside a Drizzle transaction with app.tenant_id set for RLS.
 * Use this to wrap tRPC procedures when organizationId is present.
 */
export async function runWithTenantDb<T>(
  organizationId: string,
  fn: () => Promise<T>
): Promise<T> {
  const rootDb = getRootDb();
  if (!rootDb) {
    logger.warn("runWithTenantDb: no DB; running without tenant context");
    return fn();
  }
  return rootDb.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.tenant_id', ${organizationId}, true)`);
    return tenantDbStorage.run({ tx: tx as PostgresJsDatabase }, fn);
  });
}

/** Get current request's Drizzle tx if inside runWithTenantDb. */
export function getTenantDbTx(): PostgresJsDatabase | null {
  const store = tenantDbStorage.getStore();
  return store?.tx ?? null;
}

/**
 * Request-scoped DB with tenant context (RLS). Use inside runWithTenantDb only.
 * Throws if tenant context is missing to prevent accidental non-tenant queries.
 */
export async function getDb(): Promise<PostgresJsDatabase> {
  const tenantTx = getTenantDbTx();
  if (tenantTx) return tenantTx;
  throw new Error(
    "Tenant DB context missing. Use runWithTenantDb() before accessing the database."
  );
}

// ============= USER MANAGEMENT =============

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = getRootDb();
  if (!db) {
    logger.warn("Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }
    if (user.siteId !== undefined) {
      values.siteId = user.siteId;
      updateSet.siteId = user.siteId;
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    logger.error("Failed to upsert user", {
      errorType: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = getRootDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(users).orderBy(desc(users.createdAt));
}

export async function updateUserRole(userId: number, role: "admin" | "manager" | "technician" | "user") {
  const db = await getDb();
  if (!db) return null;
  await db.update(users).set({ role }).where(eq(users.id, userId));
  return await db.select().from(users).where(eq(users.id, userId)).limit(1).then(r => r[0]);
}

// ============= SITES MANAGEMENT =============

export async function createSite(site: InsertSite) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(sites).values(site).returning({ id: sites.id });
  const insertId = result[0]?.id;
  if (!insertId || isNaN(Number(insertId))) throw new Error("Failed to get insert ID");
  return await db.select().from(sites).where(eq(sites.id, insertId)).limit(1).then(r => r[0]);
}

export async function getAllSites(organizationId?: string | null) {
  const db = await getDb();
  if (!db) return [];
  if (organizationId != null && organizationId !== "") {
    return await db.select().from(sites).where(eq(sites.organizationId, normalizeOrganizationId(organizationId))).orderBy(asc(sites.name));
  }
  return await db.select().from(sites).orderBy(asc(sites.name));
}

export async function getSiteById(id: number) {
  const db = await getDb();
  if (!db) return null;
  return await db.select().from(sites).where(eq(sites.id, id)).limit(1).then(r => r[0] || null);
}

export async function updateSite(id: number, data: Partial<InsertSite>) {
  const db = await getDb();
  if (!db) return null;
  await db.update(sites).set(data).where(eq(sites.id, id));
  return await getSiteById(id);
}

// ============= ASSET CATEGORIES =============

export async function getAllAssetCategories() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(assetCategories).orderBy(asc(assetCategories.name));
}

export async function createAssetCategory(name: string, description?: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(assetCategories).values({ name, description }).returning({ id: assetCategories.id });
  const insertId = result[0]?.id;
  if (!insertId || isNaN(Number(insertId))) throw new Error("Failed to get insert ID");
  return await db.select().from(assetCategories).where(eq(assetCategories.id, insertId)).limit(1).then(r => r[0]);
}

// ============= ASSETS MANAGEMENT =============

export async function createAsset(asset: InsertAsset) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(assets).values(asset).returning({ id: assets.id });
  const insertId = result[0]?.id;
  if (!insertId || isNaN(Number(insertId))) {
    throw new Error("Failed to get insert ID");
  }
  return await db.select().from(assets).where(eq(assets.id, insertId)).limit(1).then(r => r[0]);
}

export async function getAllAssets(filters?: { siteId?: number; status?: string; categoryId?: number; organizationId?: string | null }) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(assets);
  const conditions = [];
  
  if (filters?.siteId) conditions.push(eq(assets.siteId, filters.siteId));
  if (filters?.status) conditions.push(eq(assets.status, filters.status as any));
  if (filters?.categoryId) conditions.push(eq(assets.categoryId, filters.categoryId));
  if (filters?.organizationId != null && filters.organizationId !== "") {
    conditions.push(eq(assets.organizationId, normalizeOrganizationId(filters.organizationId)));
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  return await query.orderBy(desc(assets.createdAt));
}

export async function getAssetById(id: number) {
  const db = await getDb();
  if (!db) return null;
  return await db.select().from(assets).where(eq(assets.id, id)).limit(1).then(r => r[0] || null);
}

export async function updateAsset(id: number, data: Partial<InsertAsset>) {
  const db = await getDb();
  if (!db) return null;
  await db.update(assets).set(data).where(eq(assets.id, id));
  return await getAssetById(id);
}

export async function deleteAsset(id: number) {
  const db = await getDb();
  if (!db) return false;
  await db.delete(assets).where(eq(assets.id, id));
  return true;
}

export async function searchAssets(searchTerm: string) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(assets)
    .where(or(
      like(assets.name, `%${searchTerm}%`),
      like(assets.assetTag, `%${searchTerm}%`),
      like(assets.serialNumber, `%${searchTerm}%`)
    ))
    .orderBy(desc(assets.createdAt));
}

// ============= WORK ORDERS =============

export async function createWorkOrder(workOrder: InsertWorkOrder) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(workOrders).values(workOrder).returning({ id: workOrders.id });
  const insertId = result[0]?.id;
  if (!insertId || isNaN(Number(insertId))) throw new Error("Failed to get insert ID");
  return await db.select().from(workOrders).where(eq(workOrders.id, insertId)).limit(1).then(r => r[0]);
}

export async function getAllWorkOrders(filters?: { siteId?: number; status?: string; assignedTo?: number; organizationId?: string | null }) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(workOrders);
  const conditions = [];
  
  if (filters?.siteId) conditions.push(eq(workOrders.siteId, filters.siteId));
  if (filters?.status) conditions.push(eq(workOrders.status, filters.status as any));
  if (filters?.assignedTo) conditions.push(eq(workOrders.assignedTo, filters.assignedTo));
  if (filters?.organizationId != null && filters.organizationId !== "") {
    conditions.push(eq(workOrders.organizationId, normalizeOrganizationId(filters.organizationId)));
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  return await query.orderBy(desc(workOrders.createdAt));
}

export async function getWorkOrderById(id: number) {
  const db = await getDb();
  if (!db) return null;
  return await db.select().from(workOrders).where(eq(workOrders.id, id)).limit(1).then(r => r[0] || null);
}

export async function updateWorkOrder(id: number, data: Partial<InsertWorkOrder>) {
  const db = await getDb();
  if (!db) return null;
  await db.update(workOrders).set(data).where(eq(workOrders.id, id));
  return await getWorkOrderById(id);
}

// ============= MAINTENANCE SCHEDULES =============

export async function createMaintenanceSchedule(schedule: InsertMaintenanceSchedule) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(maintenanceSchedules).values(schedule).returning({ id: maintenanceSchedules.id });
  const insertId = result[0]?.id;
  if (!insertId || isNaN(Number(insertId))) throw new Error("Failed to get insert ID");
  return await db.select().from(maintenanceSchedules).where(eq(maintenanceSchedules.id, insertId)).limit(1).then(r => r[0]);
}

export async function getAllMaintenanceSchedules(filters?: { assetId?: number; isActive?: boolean; organizationId?: string | null }) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(maintenanceSchedules);
  const conditions = [];
  
  if (filters?.assetId) conditions.push(eq(maintenanceSchedules.assetId, filters.assetId));
  if (filters?.isActive !== undefined) conditions.push(eq(maintenanceSchedules.isActive, filters.isActive));
  if (filters?.organizationId != null && filters.organizationId !== "") {
    conditions.push(eq(maintenanceSchedules.organizationId, normalizeOrganizationId(filters.organizationId)));
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  return await query.orderBy(asc(maintenanceSchedules.nextDue));
}

export async function getUpcomingMaintenance(days: number = 30) {
  const db = await getDb();
  if (!db) return [];
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  return await db.select().from(maintenanceSchedules)
    .where(and(
      eq(maintenanceSchedules.isActive, true),
      lte(maintenanceSchedules.nextDue, futureDate)
    ))
    .orderBy(asc(maintenanceSchedules.nextDue));
}

export async function updateMaintenanceSchedule(id: number, data: Partial<InsertMaintenanceSchedule>) {
  const db = await getDb();
  if (!db) return null;
  await db.update(maintenanceSchedules).set(data).where(eq(maintenanceSchedules.id, id));
  return await db.select().from(maintenanceSchedules).where(eq(maintenanceSchedules.id, id)).limit(1).then(r => r[0] || null);
}

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

export async function deleteSite(id: number) {
  const db = await getDb();
  if (!db) return false;
  await db.delete(sites).where(eq(sites.id, id));
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

// ============= VENDORS =============

export async function createVendor(vendor: InsertVendor) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(vendors).values(vendor).returning({ id: vendors.id });
  const insertId = result[0]?.id;
  if (!insertId || isNaN(Number(insertId))) throw new Error("Failed to get insert ID");
  return await db.select().from(vendors).where(eq(vendors.id, insertId)).limit(1).then(r => r[0]);
}

export async function getAllVendors(organizationId?: string | null) {
  const db = await getDb();
  if (!db) return [];
  if (organizationId != null && organizationId !== "") {
    return await db.select().from(vendors).where(eq(vendors.organizationId, normalizeOrganizationId(organizationId))).orderBy(asc(vendors.name));
  }
  return await db.select().from(vendors).orderBy(asc(vendors.name));
}

export async function updateVendor(id: number, data: Partial<InsertVendor>) {
  const db = await getDb();
  if (!db) return null;
  await db.update(vendors).set(data).where(eq(vendors.id, id));
  return await db.select().from(vendors).where(eq(vendors.id, id)).limit(1).then(r => r[0] || null);
}

export async function getVendorScoringInputs(tenantId: number) {
  const db = await getDb();
  if (!db) return [];

  const vendorRows = await db.select().from(vendors).where(eq(vendors.isActive, true));
  if (vendorRows.length === 0) return [];

  const vendorInventory = await db
    .select()
    .from(inventoryItems)
    .where(isNotNull(inventoryItems.vendorId));

  const inventoryByVendor = new Map<number, typeof vendorInventory>();
  for (const row of vendorInventory) {
    const vendorId = row.vendorId;
    if (!vendorId) continue;
    const existing = inventoryByVendor.get(vendorId) ?? [];
    existing.push(row);
    inventoryByVendor.set(vendorId, existing);
  }

  const allTransactions = await db
    .select()
    .from(inventoryTransactions)
    .where(or(eq(inventoryTransactions.type, "in"), eq(inventoryTransactions.type, "out")));

  const transactionsByItem = new Map<number, typeof allTransactions>();
  for (const row of allTransactions) {
    const existing = transactionsByItem.get(row.itemId) ?? [];
    existing.push(row);
    transactionsByItem.set(row.itemId, existing);
  }

  return vendorRows.map((vendor) => {
    const items = inventoryByVendor.get(vendor.id) ?? [];
    const unitCosts = items.map((item) => Number(item.unitCost ?? 0)).filter((value) => value > 0);
    const avgUnitCost = unitCosts.length > 0 ? unitCosts.reduce((sum, value) => sum + value, 0) / unitCosts.length : 0;
    const avgCostDeviation =
      unitCosts.length > 1 && avgUnitCost > 0
        ? unitCosts.reduce((sum, value) => sum + Math.abs(value - avgUnitCost), 0) / unitCosts.length / avgUnitCost
        : 0;

    let txIn = 0;
    let txOut = 0;
    let txTotal = 0;
    for (const item of items) {
      const transactions = transactionsByItem.get(item.id) ?? [];
      txTotal += transactions.length;
      txIn += transactions.filter((tx) => tx.type === "in").length;
      txOut += transactions.filter((tx) => tx.type === "out").length;
    }

    const lowStockCount = items.filter((item) => item.currentStock <= item.reorderPoint).length;
    const lowStockRatio = items.length > 0 ? lowStockCount / items.length : 0;

    return {
      tenantId,
      vendorId: vendor.id,
      vendorName: vendor.name,
      txIn,
      txOut,
      txTotal,
      lowStockRatio,
      costDeviation: avgCostDeviation,
    };
  });
}

export async function upsertVendorIntelligenceSnapshots(params: {
  tenantId: number;
  performance: Array<{
    vendorId: number;
    deliveryReliability: number;
    costVariance: number;
    leadTimeStability: number;
    defectRate: number;
    vendorScore: number;
    agentExecutionId: string;
  }>;
  risks: Array<{
    vendorId: number;
    vendorScore: number;
    riskScore: number;
    riskBand: "low" | "medium" | "high";
    agentExecutionId: string;
  }>;
}) {
  const db = await getDb();
  if (!db) return { performanceRows: 0, riskRows: 0 };

  for (const row of params.performance) {
    await db
      .insert(vendorPerformanceMetrics)
      .values({
        tenantId: params.tenantId,
        vendorId: row.vendorId,
        deliveryReliability: row.deliveryReliability.toFixed(4),
        costVariance: row.costVariance.toFixed(4),
        leadTimeStability: row.leadTimeStability.toFixed(4),
        defectRate: row.defectRate.toFixed(4),
        vendorScore: row.vendorScore.toFixed(4),
        agentExecutionId: row.agentExecutionId,
      })
      .onConflictDoUpdate({
        target: [
          vendorPerformanceMetrics.tenantId,
          vendorPerformanceMetrics.vendorId,
          vendorPerformanceMetrics.agentExecutionId,
        ],
        set: {
          deliveryReliability: row.deliveryReliability.toFixed(4),
          costVariance: row.costVariance.toFixed(4),
          leadTimeStability: row.leadTimeStability.toFixed(4),
          defectRate: row.defectRate.toFixed(4),
          vendorScore: row.vendorScore.toFixed(4),
        },
      });
  }

  for (const row of params.risks) {
    await db
      .insert(vendorRiskScores)
      .values({
        tenantId: params.tenantId,
        vendorId: row.vendorId,
        vendorScore: row.vendorScore.toFixed(4),
        riskScore: row.riskScore.toFixed(4),
        riskBand: row.riskBand,
        agentExecutionId: row.agentExecutionId,
      })
      .onConflictDoUpdate({
        target: [
          vendorRiskScores.tenantId,
          vendorRiskScores.vendorId,
          vendorRiskScores.agentExecutionId,
        ],
        set: {
          vendorScore: row.vendorScore.toFixed(4),
          riskScore: row.riskScore.toFixed(4),
          riskBand: row.riskBand,
        },
      });
  }

  return {
    performanceRows: params.performance.length,
    riskRows: params.risks.length,
  };
}

export async function listVendorRiskScores(params: { tenantId: number; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(vendorRiskScores)
    .where(eq(vendorRiskScores.tenantId, params.tenantId))
    .orderBy(desc(vendorRiskScores.createdAt))
    .limit(params.limit ?? 50);
}

export async function getProcurementInputSignals(params: { tenantId: number; stockItemId?: number }) {
  const db = await getDb();
  if (!db) return [];

  const inventoryRows = params.stockItemId
    ? await db.select().from(inventoryItems).where(eq(inventoryItems.id, params.stockItemId))
    : await db.select().from(inventoryItems);
  const vendorRiskRows = await db
    .select()
    .from(vendorRiskScores)
    .where(eq(vendorRiskScores.tenantId, params.tenantId))
    .orderBy(desc(vendorRiskScores.createdAt));

  const latestRiskByVendor = new Map<number, { riskScore: number }>();
  for (const row of vendorRiskRows) {
    if (!latestRiskByVendor.has(row.vendorId)) {
      latestRiskByVendor.set(row.vendorId, { riskScore: Number(row.riskScore) });
    }
  }

  return inventoryRows
    .filter((item) => item.vendorId !== null && item.vendorId !== undefined)
    .map((item) => {
      const deficit = Math.max(0, item.reorderPoint - item.currentStock);
      const demandPressure = item.reorderPoint > 0 ? deficit / item.reorderPoint : 0;
      const stockoutProbability = item.minStockLevel > 0 ? Math.max(0, (item.minStockLevel - item.currentStock) / item.minStockLevel) : 0;
      const risk = latestRiskByVendor.get(item.vendorId!);
      const vendorRisk = risk?.riskScore ?? 0.5;
      const leadTimeRisk = Math.min(1, vendorRisk * 0.9 + 0.1);

      return {
        tenantId: params.tenantId,
        stockItemId: item.id,
        candidateVendorId: item.vendorId!,
        demandPressure: Math.max(0, Math.min(1, Number(demandPressure.toFixed(4)))),
        leadTimeRisk: Math.max(0, Math.min(1, Number(leadTimeRisk.toFixed(4)))),
        vendorRisk: Math.max(0, Math.min(1, Number(vendorRisk.toFixed(4)))),
        stockoutProbability: Math.max(0, Math.min(1, Number(stockoutProbability.toFixed(4)))),
        currentStock: item.currentStock,
        reorderPoint: item.reorderPoint,
        unitCost: Number(item.unitCost ?? 0),
      };
    });
}

export async function upsertProcurementRecommendations(params: {
  tenantId: number;
  recommendations: Array<{
    stockItemId: number;
    recommendedVendorId: number;
    recommendedQuantity: number;
    demandScore: number;
    vendorRiskScore: number;
    procurementPriority: "monitor" | "prepare_procurement" | "reorder" | "immediate_procurement";
    agentExecutionId: string;
  }>;
}) {
  const db = await getDb();
  if (!db || params.recommendations.length === 0) return 0;

  for (const row of params.recommendations) {
    await db
      .insert(procurementRecommendations)
      .values({
        tenantId: params.tenantId,
        stockItemId: row.stockItemId,
        recommendedVendorId: row.recommendedVendorId,
        recommendedQuantity: row.recommendedQuantity,
        demandScore: row.demandScore.toFixed(4),
        vendorRiskScore: row.vendorRiskScore.toFixed(4),
        procurementPriority: row.procurementPriority,
        agentExecutionId: row.agentExecutionId,
      })
      .onConflictDoUpdate({
        target: [
          procurementRecommendations.tenantId,
          procurementRecommendations.stockItemId,
          procurementRecommendations.recommendedVendorId,
          procurementRecommendations.agentExecutionId,
        ],
        set: {
          recommendedQuantity: row.recommendedQuantity,
          demandScore: row.demandScore.toFixed(4),
          vendorRiskScore: row.vendorRiskScore.toFixed(4),
          procurementPriority: row.procurementPriority,
        },
      });
  }
  return params.recommendations.length;
}

export async function listProcurementRecommendations(params: {
  tenantId: number;
  stockItemId?: number;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(procurementRecommendations.tenantId, params.tenantId)];
  if (params.stockItemId) {
    conditions.push(eq(procurementRecommendations.stockItemId, params.stockItemId));
  }
  return db
    .select()
    .from(procurementRecommendations)
    .where(and(...conditions))
    .orderBy(desc(procurementRecommendations.createdAt))
    .limit(params.limit ?? 50);
}

export async function createPurchaseOrderFromRecommendation(params: {
  tenantId: number;
  recommendationId: number;
}) {
  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select()
    .from(procurementRecommendations)
    .where(
      and(
        eq(procurementRecommendations.id, params.recommendationId),
        eq(procurementRecommendations.tenantId, params.tenantId),
      ),
    )
    .limit(1);
  const recommendation = rows[0];
  if (!recommendation) return null;

  const itemRows = await db
    .select()
    .from(inventoryItems)
    .where(eq(inventoryItems.id, recommendation.stockItemId))
    .limit(1);
  const item = itemRows[0];
  const unitCost = Number(item?.unitCost ?? 0);
  const totalValue = unitCost * recommendation.recommendedQuantity;

  const result = await db.insert(purchaseOrders).values({
    tenantId: params.tenantId,
    vendorId: recommendation.recommendedVendorId,
    status: "draft",
    totalValue: totalValue.toFixed(2),
  }).returning({ id: purchaseOrders.id });
  const insertId = result[0]?.id;
  if (!insertId) return null;
  const inserted = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, insertId)).limit(1);
  return inserted[0] ?? null;
}

export async function getSupplyChainRiskInputs(params: {
  tenantId: number;
  stockItemId?: number;
  vendorId?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const inventoryRows = params.stockItemId
    ? await db.select().from(inventoryItems).where(eq(inventoryItems.id, params.stockItemId))
    : await db.select().from(inventoryItems);

  const vendorRiskRows = await db
    .select()
    .from(vendorRiskScores)
    .where(eq(vendorRiskScores.tenantId, params.tenantId))
    .orderBy(desc(vendorRiskScores.createdAt));
  const latestVendorRisk = new Map<number, number>();
  for (const row of vendorRiskRows) {
    if (!latestVendorRisk.has(row.vendorId)) {
      latestVendorRisk.set(row.vendorId, Number(row.riskScore));
    }
  }

  const procurementRows = await db
    .select()
    .from(procurementRecommendations)
    .where(eq(procurementRecommendations.tenantId, params.tenantId))
    .orderBy(desc(procurementRecommendations.createdAt));
  const latestProcByStock = new Map<number, { demandScore: number }>();
  for (const row of procurementRows) {
    if (!latestProcByStock.has(row.stockItemId)) {
      latestProcByStock.set(row.stockItemId, { demandScore: Number(row.demandScore) });
    }
  }

  const transferRows = await db
    .select()
    .from(warehouseTransferRecommendations)
    .where(eq(warehouseTransferRecommendations.tenantId, params.tenantId))
    .orderBy(desc(warehouseTransferRecommendations.createdAt));
  const transferCountByStock = new Map<number, number>();
  for (const row of transferRows) {
    transferCountByStock.set(row.stockItemId, (transferCountByStock.get(row.stockItemId) ?? 0) + 1);
  }

  const scopedItems = inventoryRows.filter((item) => item.vendorId !== null && item.vendorId !== undefined);
  return scopedItems
    .filter((item) => (params.vendorId ? item.vendorId === params.vendorId : true))
    .map((item) => {
      const deficit = Math.max(0, item.reorderPoint - item.currentStock);
      const demandVolatility = latestProcByStock.get(item.id)?.demandScore ?? (item.reorderPoint > 0 ? deficit / item.reorderPoint : 0);
      const vendorRisk = latestVendorRisk.get(item.vendorId!) ?? 0.5;
      const leadTimeRisk = Math.min(1, vendorRisk * 0.85 + 0.1);
      const inventoryPressure = item.minStockLevel > 0 ? Math.max(0, (item.minStockLevel - item.currentStock) / item.minStockLevel) : 0;
      const transferCount = transferCountByStock.get(item.id) ?? 0;
      const transportRisk = Math.min(1, transferCount / 10);

      return {
        tenantId: params.tenantId,
        stockItemId: item.id,
        vendorId: item.vendorId!,
        demandVolatility: Number(Math.max(0, Math.min(1, demandVolatility)).toFixed(4)),
        leadTimeRisk: Number(Math.max(0, Math.min(1, leadTimeRisk)).toFixed(4)),
        vendorRisk: Number(Math.max(0, Math.min(1, vendorRisk)).toFixed(4)),
        transportRisk: Number(Math.max(0, Math.min(1, transportRisk)).toFixed(4)),
        inventoryPressure: Number(Math.max(0, Math.min(1, inventoryPressure)).toFixed(4)),
      };
    });
}

export async function upsertSupplyChainRiskSnapshots(params: {
  tenantId: number;
  scores: Array<{
    stockItemId: number;
    vendorId: number;
    demandVolatility: number;
    leadTimeRisk: number;
    vendorRisk: number;
    transportRisk: number;
    inventoryPressure: number;
    riskIndex: number;
    riskBand: "low" | "moderate" | "elevated" | "high" | "critical";
    agentExecutionId: string;
  }>;
}) {
  const db = await getDb();
  if (!db || params.scores.length === 0) return { scoreRows: 0, eventRows: 0 };

  let eventRows = 0;
  for (const row of params.scores) {
    await db
      .insert(supplyChainRiskScores)
      .values({
        tenantId: params.tenantId,
        stockItemId: row.stockItemId,
        vendorId: row.vendorId,
        demandVolatility: row.demandVolatility.toFixed(4),
        leadTimeRisk: row.leadTimeRisk.toFixed(4),
        vendorRisk: row.vendorRisk.toFixed(4),
        transportRisk: row.transportRisk.toFixed(4),
        inventoryPressure: row.inventoryPressure.toFixed(4),
        supplyChainRiskIndex: row.riskIndex.toFixed(4),
        riskBand: row.riskBand,
        agentExecutionId: row.agentExecutionId,
      })
      .onConflictDoUpdate({
        target: [
          supplyChainRiskScores.tenantId,
          supplyChainRiskScores.stockItemId,
          supplyChainRiskScores.vendorId,
          supplyChainRiskScores.agentExecutionId,
        ],
        set: {
          demandVolatility: row.demandVolatility.toFixed(4),
          leadTimeRisk: row.leadTimeRisk.toFixed(4),
          vendorRisk: row.vendorRisk.toFixed(4),
          transportRisk: row.transportRisk.toFixed(4),
          inventoryPressure: row.inventoryPressure.toFixed(4),
          supplyChainRiskIndex: row.riskIndex.toFixed(4),
          riskBand: row.riskBand,
        },
      });

    if (row.riskBand === "high" || row.riskBand === "critical") {
      await db
        .insert(supplyChainRiskEvents)
        .values({
          tenantId: params.tenantId,
          stockItemId: row.stockItemId,
          vendorId: row.vendorId,
          riskType: "supply_chain_risk_event",
          riskScore: row.riskIndex.toFixed(4),
          riskBand: row.riskBand,
          description: `Risk ${row.riskBand} for stock item ${row.stockItemId} and vendor ${row.vendorId}`,
          agentExecutionId: row.agentExecutionId,
        })
        .onConflictDoUpdate({
          target: [
            supplyChainRiskEvents.tenantId,
            supplyChainRiskEvents.stockItemId,
            supplyChainRiskEvents.vendorId,
            supplyChainRiskEvents.riskType,
            supplyChainRiskEvents.agentExecutionId,
          ],
          set: {
            riskScore: row.riskIndex.toFixed(4),
            riskBand: row.riskBand,
            description: `Risk ${row.riskBand} for stock item ${row.stockItemId} and vendor ${row.vendorId}`,
          },
        });
      eventRows += 1;
    }
  }

  return {
    scoreRows: params.scores.length,
    eventRows,
  };
}

export async function listSupplyChainRiskScores(params: {
  tenantId: number;
  stockItemId?: number;
  vendorId?: number;
  riskBand?: "low" | "moderate" | "elevated" | "high" | "critical";
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(supplyChainRiskScores.tenantId, params.tenantId)];
  if (params.stockItemId) conditions.push(eq(supplyChainRiskScores.stockItemId, params.stockItemId));
  if (params.vendorId) conditions.push(eq(supplyChainRiskScores.vendorId, params.vendorId));
  if (params.riskBand) conditions.push(eq(supplyChainRiskScores.riskBand, params.riskBand));

  return db
    .select()
    .from(supplyChainRiskScores)
    .where(and(...conditions))
    .orderBy(desc(supplyChainRiskScores.createdAt))
    .limit(params.limit ?? 50);
}

export async function getDispatchOptimizationInputs(params: {
  tenantId: number;
  workOrderId?: number;
  facilityId?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  let workOrderRows = params.workOrderId
    ? await db.select().from(workOrders).where(eq(workOrders.id, params.workOrderId))
    : await db
        .select()
        .from(workOrders)
        .where(or(eq(workOrders.status, "pending"), eq(workOrders.status, "assigned"), eq(workOrders.status, "in_progress")));

  if (params.facilityId) {
    workOrderRows = workOrderRows.filter((row) => row.siteId === params.facilityId);
  }
  if (workOrderRows.length === 0) return [];

  const technicianRows = await db
    .select()
    .from(technicians)
    .where(and(eq(technicians.tenantId, params.tenantId), eq(technicians.availabilityStatus, "available")));
  const fleetRows = await db
    .select()
    .from(fleetUnits)
    .where(and(eq(fleetUnits.tenantId, params.tenantId), eq(fleetUnits.status, "available")));
  if (technicianRows.length === 0 || fleetRows.length === 0) return [];

  const assignmentRows = await db
    .select()
    .from(dispatchAssignments)
    .where(eq(dispatchAssignments.tenantId, params.tenantId));
  const assignmentsByTechnician = new Map<number, number>();
  for (const row of assignmentRows) {
    assignmentsByTechnician.set(row.technicianId, (assignmentsByTechnician.get(row.technicianId) ?? 0) + 1);
  }
  const maxWorkload = Math.max(1, ...Array.from(assignmentsByTechnician.values()));

  return workOrderRows.flatMap((wo) => {
    const requiredSkill =
      wo.type === "inspection"
        ? "inspection"
        : wo.type === "preventive"
          ? "calibration"
          : wo.type === "corrective"
            ? "mechanical"
            : "electrical";
    const assetPriority =
      wo.priority === "critical" ? 1 : wo.priority === "high" ? 0.75 : wo.priority === "medium" ? 0.5 : 0.25;

    return technicianRows.flatMap((tech) => {
      const workload = assignmentsByTechnician.get(tech.id) ?? 0;
      const workloadBalance = Math.max(0, 1 - workload / maxWorkload);
      const skillMatch = tech.skillProfile.toLowerCase().includes(requiredSkill) ? 1 : 0.3;

      return fleetRows.map((fleet) => {
        const baseDistance = Math.abs((tech.id % 30) - (wo.siteId % 30)) + Math.abs((fleet.id % 20) - (wo.id % 20));
        const routeDistance = Number((baseDistance + 3).toFixed(2));
        const travelTime = Number(Math.max(0, Math.min(1, routeDistance / 120)).toFixed(4));
        const routeEfficiency = Number((1 - Math.min(1, routeDistance / 150)).toFixed(4));

        return {
          tenantId: params.tenantId,
          workOrderId: wo.id,
          technicianId: tech.id,
          fleetUnitId: fleet.id,
          travelTime,
          technicianSkillMatch: skillMatch,
          assetPriority,
          workloadBalance: Number(workloadBalance.toFixed(4)),
          routeEfficiency,
          routeDistance,
        };
      });
    });
  });
}

export async function upsertDispatchAssignments(params: {
  tenantId: number;
  assignments: Array<{
    workOrderId: number;
    technicianId: number;
    fleetUnitId: number;
    dispatchPriority: "routine" | "prioritized" | "urgent" | "critical";
    estimatedTravelTime: number;
    routeDistance: number;
    dispatchScore: number;
    agentExecutionId: string;
  }>;
}) {
  const db = await getDb();
  if (!db || params.assignments.length === 0) return 0;

  for (const row of params.assignments) {
    await db
      .insert(dispatchAssignments)
      .values({
        tenantId: params.tenantId,
        workOrderId: row.workOrderId,
        technicianId: row.technicianId,
        fleetUnitId: row.fleetUnitId,
        dispatchPriority: row.dispatchPriority,
        estimatedTravelTime: row.estimatedTravelTime.toFixed(2),
        routeDistance: row.routeDistance.toFixed(2),
        dispatchScore: row.dispatchScore.toFixed(4),
        status: "created",
        agentExecutionId: row.agentExecutionId,
      })
      .onConflictDoUpdate({
        target: [
          dispatchAssignments.tenantId,
          dispatchAssignments.workOrderId,
          dispatchAssignments.technicianId,
          dispatchAssignments.fleetUnitId,
          dispatchAssignments.agentExecutionId,
        ],
        set: {
          dispatchPriority: row.dispatchPriority,
          estimatedTravelTime: row.estimatedTravelTime.toFixed(2),
          routeDistance: row.routeDistance.toFixed(2),
          dispatchScore: row.dispatchScore.toFixed(4),
          status: "created",
        },
      });
  }
  return params.assignments.length;
}

export async function listDispatchAssignments(params: {
  tenantId: number;
  facilityId?: number;
  technicianId?: number;
  status?: "created" | "completed" | "delayed";
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(dispatchAssignments.tenantId, params.tenantId)];
  if (params.technicianId) {
    conditions.push(eq(dispatchAssignments.technicianId, params.technicianId));
  }
  if (params.status) {
    conditions.push(eq(dispatchAssignments.status, params.status));
  }

  let rows = await db
    .select()
    .from(dispatchAssignments)
    .where(and(...conditions))
    .orderBy(desc(dispatchAssignments.createdAt))
    .limit(params.limit ?? 50);

  if (params.facilityId) {
    const allowedWorkOrders = await db
      .select({ id: workOrders.id })
      .from(workOrders)
      .where(eq(workOrders.siteId, params.facilityId));
    const allowedSet = new Set(allowedWorkOrders.map((wo) => wo.id));
    rows = rows.filter((row) => allowedSet.has(row.workOrderId));
  }

  return rows;
}

export async function getExecutiveMetricsInputs(tenantId: number) {
  const db = await getDb();
  if (!db) {
    return {
      assetHealthIndex: 0.5,
      maintenanceCostProjection: 0.5,
      inventoryPressureIndex: 0.5,
      vendorRiskIndex: 0.5,
      supplyChainRiskIndex: 0.5,
      fleetUtilizationRate: 0.5,
      technicianProductivityScore: 0.5,
    };
  }

  const latestPredictive = await db
    .select()
    .from(predictiveScores)
    .where(eq(predictiveScores.tenantId, tenantId))
    .orderBy(desc(predictiveScores.scoredAt))
    .limit(50);
  const avgRisk = latestPredictive.length
    ? latestPredictive.reduce((sum, row) => sum + Number(row.riskScore), 0) / latestPredictive.length / 100
    : 0.5;
  const assetHealthIndex = Number((1 - Math.max(0, Math.min(1, avgRisk))).toFixed(4));

  const recentFinancial = await db
    .select()
    .from(financialTransactions)
    .orderBy(desc(financialTransactions.transactionDate))
    .limit(100);
  const maintenanceTx = recentFinancial.filter((row) =>
    row.transactionType === "maintenance" || row.transactionType === "repair",
  );
  const maintenanceAvg = maintenanceTx.length
    ? maintenanceTx.reduce((sum, row) => sum + Number(row.amount), 0) / maintenanceTx.length
    : 0;
  const maintenanceCostProjection = Number(Math.max(0, Math.min(1, maintenanceAvg / 1000000)).toFixed(4));

  const inventoryRows = await db.select().from(inventoryItems);
  const pressureRatios = inventoryRows.map((row) =>
    row.reorderPoint > 0 ? Math.max(0, (row.reorderPoint - row.currentStock) / row.reorderPoint) : 0,
  );
  const inventoryPressureIndex = pressureRatios.length
    ? Number((pressureRatios.reduce((sum, v) => sum + v, 0) / pressureRatios.length).toFixed(4))
    : 0.5;

  const latestVendorRisks = await db
    .select()
    .from(vendorRiskScores)
    .where(eq(vendorRiskScores.tenantId, tenantId))
    .orderBy(desc(vendorRiskScores.createdAt))
    .limit(100);
  const vendorRiskIndex = latestVendorRisks.length
    ? Number((latestVendorRisks.reduce((sum, row) => sum + Number(row.riskScore), 0) / latestVendorRisks.length).toFixed(4))
    : 0.5;

  const latestSupplyChain = await db
    .select()
    .from(supplyChainRiskScores)
    .where(eq(supplyChainRiskScores.tenantId, tenantId))
    .orderBy(desc(supplyChainRiskScores.createdAt))
    .limit(100);
  const supplyChainRiskIndex = latestSupplyChain.length
    ? Number(
        (latestSupplyChain.reduce((sum, row) => sum + Number(row.supplyChainRiskIndex), 0) / latestSupplyChain.length).toFixed(4),
      )
    : 0.5;

  const fleetRows = await db.select().from(fleetUnits).where(eq(fleetUnits.tenantId, tenantId));
  const assignedFleet = fleetRows.filter((row) => row.status === "assigned").length;
  const fleetUtilizationRate = fleetRows.length ? Number((assignedFleet / fleetRows.length).toFixed(4)) : 0.5;

  const dispatchRows = await db
    .select()
    .from(dispatchAssignments)
    .where(eq(dispatchAssignments.tenantId, tenantId))
    .orderBy(desc(dispatchAssignments.createdAt))
    .limit(100);
  const completedOrCreated = dispatchRows.filter((row) => row.status === "completed" || row.status === "created").length;
  const technicianProductivityScore = dispatchRows.length ? Number((completedOrCreated / dispatchRows.length).toFixed(4)) : 0.5;

  return {
    assetHealthIndex,
    maintenanceCostProjection,
    inventoryPressureIndex,
    vendorRiskIndex,
    supplyChainRiskIndex,
    fleetUtilizationRate,
    technicianProductivityScore,
  };
}

export async function upsertExecutiveMetricsSnapshot(params: {
  tenantId: number;
  snapshotDate: Date;
  agentExecutionId: string;
  snapshot: {
    assetHealthIndex: number;
    maintenanceCostProjection: number;
    inventoryPressureIndex: number;
    vendorRiskIndex: number;
    supplyChainRiskIndex: number;
    fleetUtilizationRate: number;
    technicianProductivityScore: number;
    overallOperationsIndex: number;
  };
}) {
  const db = await getDb();
  if (!db) return { snapshotRows: 0, trendRows: 0 };

  await db
    .insert(executiveMetricsSnapshots)
    .values({
      tenantId: params.tenantId,
      snapshotDate: params.snapshotDate,
      assetHealthIndex: params.snapshot.assetHealthIndex.toFixed(4),
      maintenanceCostProjection: params.snapshot.maintenanceCostProjection.toFixed(4),
      inventoryPressureIndex: params.snapshot.inventoryPressureIndex.toFixed(4),
      vendorRiskIndex: params.snapshot.vendorRiskIndex.toFixed(4),
      supplyChainRiskIndex: params.snapshot.supplyChainRiskIndex.toFixed(4),
      fleetUtilizationRate: params.snapshot.fleetUtilizationRate.toFixed(4),
      technicianProductivityScore: params.snapshot.technicianProductivityScore.toFixed(4),
      overallOperationsIndex: params.snapshot.overallOperationsIndex.toFixed(2),
      agentExecutionId: params.agentExecutionId,
    })
    .onConflictDoUpdate({
      target: [
        executiveMetricsSnapshots.tenantId,
        executiveMetricsSnapshots.snapshotDate,
        executiveMetricsSnapshots.agentExecutionId,
      ],
      set: {
        assetHealthIndex: params.snapshot.assetHealthIndex.toFixed(4),
        maintenanceCostProjection: params.snapshot.maintenanceCostProjection.toFixed(4),
        inventoryPressureIndex: params.snapshot.inventoryPressureIndex.toFixed(4),
        vendorRiskIndex: params.snapshot.vendorRiskIndex.toFixed(4),
        supplyChainRiskIndex: params.snapshot.supplyChainRiskIndex.toFixed(4),
        fleetUtilizationRate: params.snapshot.fleetUtilizationRate.toFixed(4),
        technicianProductivityScore: params.snapshot.technicianProductivityScore.toFixed(4),
        overallOperationsIndex: params.snapshot.overallOperationsIndex.toFixed(2),
      },
    });

  const trendItems: Array<{ metricName: string; metricValue: number }> = [
    { metricName: "asset_health_index", metricValue: params.snapshot.assetHealthIndex },
    { metricName: "maintenance_cost_projection", metricValue: params.snapshot.maintenanceCostProjection },
    { metricName: "inventory_pressure_index", metricValue: params.snapshot.inventoryPressureIndex },
    { metricName: "vendor_risk_index", metricValue: params.snapshot.vendorRiskIndex },
    { metricName: "supply_chain_risk_index", metricValue: params.snapshot.supplyChainRiskIndex },
    { metricName: "fleet_utilization_rate", metricValue: params.snapshot.fleetUtilizationRate },
    { metricName: "technician_productivity_score", metricValue: params.snapshot.technicianProductivityScore },
    { metricName: "overall_operations_index", metricValue: params.snapshot.overallOperationsIndex },
  ];

  let trendRows = 0;
  for (const item of trendItems) {
    const previous = await db
      .select()
      .from(operationalKpiTrends)
      .where(and(eq(operationalKpiTrends.tenantId, params.tenantId), eq(operationalKpiTrends.metricName, item.metricName)))
      .orderBy(desc(operationalKpiTrends.metricDate))
      .limit(1);
    const prevValue = previous[0] ? Number(previous[0].metricValue) : item.metricValue;
    const trendDirection = item.metricValue > prevValue ? "up" : item.metricValue < prevValue ? "down" : "stable";

    await db
      .insert(operationalKpiTrends)
      .values({
        tenantId: params.tenantId,
        metricName: item.metricName,
        metricValue: item.metricValue.toFixed(4),
        metricDate: params.snapshotDate,
        trendDirection,
        agentExecutionId: params.agentExecutionId,
      })
      .onConflictDoUpdate({
        target: [
          operationalKpiTrends.tenantId,
          operationalKpiTrends.metricName,
          operationalKpiTrends.metricDate,
          operationalKpiTrends.agentExecutionId,
        ],
        set: {
          metricValue: item.metricValue.toFixed(4),
          trendDirection,
        },
      });
    trendRows += 1;
  }

  return { snapshotRows: 1, trendRows };
}

export async function getLatestExecutiveMetricsSnapshot(tenantId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(executiveMetricsSnapshots)
    .where(eq(executiveMetricsSnapshots.tenantId, tenantId))
    .orderBy(desc(executiveMetricsSnapshots.snapshotDate))
    .limit(1);
  return rows[0] ?? null;
}

export async function listOperationalKpiTrends(params: {
  tenantId: number;
  metricName?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(operationalKpiTrends.tenantId, params.tenantId)];
  if (params.metricName) conditions.push(eq(operationalKpiTrends.metricName, params.metricName));
  if (params.startDate) conditions.push(gte(operationalKpiTrends.metricDate, params.startDate));
  if (params.endDate) conditions.push(lte(operationalKpiTrends.metricDate, params.endDate));

  return db
    .select()
    .from(operationalKpiTrends)
    .where(and(...conditions))
    .orderBy(desc(operationalKpiTrends.metricDate))
    .limit(params.limit ?? 100);
}

// ============= FINANCIAL TRANSACTIONS =============

export async function createFinancialTransaction(transaction: typeof financialTransactions.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(financialTransactions).values(transaction).returning({ id: financialTransactions.id });
  const insertId = result[0]?.id;
  if (!insertId) throw new Error("Failed to get insert ID");
  return await db.select().from(financialTransactions).where(eq(financialTransactions.id, Number(insertId))).limit(1).then(r => r[0]);
}

export async function getFinancialTransactions(filters?: { assetId?: number; workOrderId?: number; startDate?: Date; endDate?: Date }) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(financialTransactions);
  const conditions = [];
  
  if (filters?.assetId) conditions.push(eq(financialTransactions.assetId, filters.assetId));
  if (filters?.workOrderId) conditions.push(eq(financialTransactions.workOrderId, filters.workOrderId));
  if (filters?.startDate) conditions.push(gte(financialTransactions.transactionDate, filters.startDate));
  if (filters?.endDate) conditions.push(lte(financialTransactions.transactionDate, filters.endDate));
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  return await query.orderBy(desc(financialTransactions.transactionDate));
}

/** Precomputed financial totals (revenue vs expenses). No client-side reduce. */
export async function getFinancialSummary(filters?: { startDate?: Date; endDate?: Date }) {
  const db = await getDb();
  if (!db) return { totalRevenue: 0, totalExpenses: 0 };

  const conditions = [];
  if (filters?.startDate) conditions.push(gte(financialTransactions.transactionDate, filters.startDate));
  if (filters?.endDate) conditions.push(lte(financialTransactions.transactionDate, filters.endDate));

  const baseQuery = db
    .select({
      transactionType: financialTransactions.transactionType,
      total: sql<number>`COALESCE(SUM(CAST(${financialTransactions.amount} AS DECIMAL(15,2))), 0)`.as("total"),
    })
    .from(financialTransactions);

  const rows =
    conditions.length > 0
      ? await baseQuery.where(and(...conditions)).groupBy(financialTransactions.transactionType)
      : await baseQuery.groupBy(financialTransactions.transactionType);
  const revenueTypes = ["revenue"];
  const expenseTypes = ["acquisition", "maintenance", "repair", "disposal", "depreciation", "other"];
  let totalRevenue = 0;
  let totalExpenses = 0;
  for (const row of rows) {
    const t = Number(row.total);
    if (revenueTypes.includes(row.transactionType)) totalRevenue += t;
    if (expenseTypes.includes(row.transactionType)) totalExpenses += t;
  }
  return { totalRevenue, totalExpenses };
}

// ============= COMPLIANCE =============

export async function createComplianceRecord(record: typeof complianceRecords.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(complianceRecords).values(record).returning({ id: complianceRecords.id });
  const insertId = result[0]?.id;
  if (!insertId) throw new Error("Failed to get insert ID");
  return await db.select().from(complianceRecords).where(eq(complianceRecords.id, Number(insertId))).limit(1).then(r => r[0]);
}

export async function getAllComplianceRecords(filters?: { assetId?: number; status?: string; organizationId?: string | null }) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(complianceRecords);
  const conditions = [];
  
  if (filters?.assetId) conditions.push(eq(complianceRecords.assetId, filters.assetId));
  if (filters?.status) conditions.push(eq(complianceRecords.status, filters.status as any));
  if (filters?.organizationId != null && filters.organizationId !== "") {
    conditions.push(eq(complianceRecords.organizationId, normalizeOrganizationId(filters.organizationId)));
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  return await query.orderBy(desc(complianceRecords.createdAt));
}

export async function updateComplianceRecord(id: number, data: Partial<typeof complianceRecords.$inferInsert>) {
  const db = await getDb();
  if (!db) return null;
  await db.update(complianceRecords).set(data).where(eq(complianceRecords.id, id));
  return await db.select().from(complianceRecords).where(eq(complianceRecords.id, id)).limit(1).then(r => r[0] || null);
}

// ============= AUDIT LOGS =============

export async function createAuditLog(log: typeof auditLogs.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(auditLogs).values(log);
}

export async function getAuditLogs(filters?: { userId?: number; entityType?: string; entityId?: number; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(auditLogs);
  const conditions = [];
  
  if (filters?.userId) conditions.push(eq(auditLogs.userId, filters.userId));
  if (filters?.entityType) conditions.push(eq(auditLogs.entityType, filters.entityType));
  if (filters?.entityId) conditions.push(eq(auditLogs.entityId, filters.entityId));
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  const result = query.orderBy(desc(auditLogs.timestamp));
  
  if (filters?.limit) {
    return await result.limit(filters.limit);
  }
  
  return await result;
}

// ============= DOCUMENTS =============

export async function createDocument(doc: typeof documents.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const nextDoc = { ...doc };
  if (!nextDoc.organizationId) {
    if (nextDoc.entityType === "organization" && typeof nextDoc.entityId === "number" && nextDoc.entityId > 0) {
      nextDoc.organizationId = normalizeOrganizationId(nextDoc.entityId);
    }
  } else {
    nextDoc.organizationId = normalizeOrganizationId(nextDoc.organizationId);
  }
  const result = await db.insert(documents).values(nextDoc).returning({ id: documents.id });
  const insertId = result[0]?.id;
  if (!insertId) throw new Error("Failed to get insert ID");
  return await db.select().from(documents).where(eq(documents.id, Number(insertId))).limit(1).then(r => r[0]);
}

export async function getDocuments(entityType?: string, entityId?: number): Promise<(typeof documents.$inferSelect)[]>;
export async function getDocuments(filters: {
  entityType?: string;
  entityId?: number;
  organizationId?: string | number;
}): Promise<(typeof documents.$inferSelect)[]>;
export async function getDocuments(
  entityTypeOrFilters?: string | { entityType?: string; entityId?: number; organizationId?: string | number },
  entityId?: number
) {
  const db = await getDb();
  if (!db) return [];

  const isObjectFilters = typeof entityTypeOrFilters === "object" && entityTypeOrFilters !== null;
  const filters = isObjectFilters
    ? entityTypeOrFilters
    : { entityType: entityTypeOrFilters, entityId };
  const conditions = [];

  if (isObjectFilters) {
    if (filters.entityType) {
      conditions.push(eq(documents.entityType, filters.entityType));
    }
    if (typeof filters.entityId === "number") {
      conditions.push(eq(documents.entityId, filters.entityId));
    }
  } else if (filters.entityType && typeof filters.entityId === "number") {
    conditions.push(and(eq(documents.entityType, filters.entityType), eq(documents.entityId, filters.entityId)));
  }
  if (filters.organizationId !== undefined && filters.organizationId !== null) {
    conditions.push(eq(documents.organizationId, normalizeOrganizationId(filters.organizationId)));
  }

  if (conditions.length > 0) {
    return await db
      .select()
      .from(documents)
      .where(and(...conditions))
      .orderBy(desc(documents.createdAt));
  }

  return await db.select().from(documents).orderBy(desc(documents.createdAt));
}

const UUID_V4_LIKE_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeOrganizationId(input: string | number): string {
  if (typeof input === "string") {
    const trimmed = input.trim().toLowerCase();
    if (UUID_V4_LIKE_PATTERN.test(trimmed)) return trimmed;
    throw new Error("organizationId must be a UUID string or positive numeric tenant id");
  }

  if (!Number.isInteger(input) || input <= 0) {
    throw new Error("organizationId must be a UUID string or positive numeric tenant id");
  }

  const tenantHex = Number(input).toString(16).padStart(12, "0").slice(-12);
  return `00000000-0000-4000-8000-${tenantHex}`;
}

export async function getActiveOrganizationEncryptionKey(
  organizationId: string | number,
  keyVersion?: number
) {
  const db = await getDb();
  if (!db) return null;
  const orgId = normalizeOrganizationId(organizationId);
  const query =
    Number.isInteger(keyVersion) && Number(keyVersion) > 0
      ? sql`
          select id, organization_id, key_version, encrypted_key, status, created_at
          from organization_encryption_keys
          where organization_id = ${orgId} and key_version = ${Number(keyVersion)}
          order by key_version desc
          limit 1
        `
      : sql`
          select id, organization_id, key_version, encrypted_key, status, created_at
          from organization_encryption_keys
          where organization_id = ${orgId} and status = 'active'
          order by key_version desc
          limit 1
        `;

  const rows = await db.execute(query);
  const row = ((rows as unknown[])?.[0] ?? null) as
    | {
        id: string;
        organization_id: string;
        key_version: number;
        encrypted_key: string;
        status: string;
        created_at: Date | string;
      }
    | null;
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    encryptedKey: row.encrypted_key,
    keyVersion: Number(row.key_version),
    status: row.status,
    createdAt: new Date(row.created_at),
  } as {
    id: string;
    organizationId: string;
    encryptedKey: string;
    keyVersion: number;
    status: string;
    createdAt: Date;
  };
}

export async function createOrganizationEncryptionKey(params: {
  organizationId: string | number;
  encryptedKey: string;
  keyVersion: number;
  status?: "active" | "retired";
}) {
  const db = await getDb();
  if (!db) return null;
  const orgId = normalizeOrganizationId(params.organizationId);
  const nextStatus = params.status ?? "active";

  if (nextStatus === "active") {
    await db.execute(sql`
      update organization_encryption_keys
      set status = 'retired', retired_at = now()
      where organization_id = ${orgId}
        and status = 'active'
    `);
  }

  await db.execute(sql`
    insert into organization_encryption_keys (
      organization_id,
      key_version,
      encrypted_key,
      status
    ) values (
      ${orgId},
      ${params.keyVersion},
      ${params.encryptedKey},
      ${nextStatus}
    )
  `);

  const rows = await db.execute(sql`
    select id, organization_id, key_version, encrypted_key, status, created_at
    from organization_encryption_keys
    where organization_id = ${orgId}
      and key_version = ${params.keyVersion}
    limit 1
  `);
  const row = ((rows as unknown[])?.[0] ?? null) as
    | {
        id: string;
        organization_id: string;
        key_version: number;
        encrypted_key: string;
        status: string;
        created_at: Date | string;
      }
    | null;
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    encryptedKey: row.encrypted_key,
    keyVersion: Number(row.key_version),
    status: row.status,
    createdAt: new Date(row.created_at),
  } as {
    id: string;
    organizationId: string;
    encryptedKey: string;
    keyVersion: number;
    status: string;
    createdAt: Date;
  };
}

export async function createEncryptedDocumentMetadata(params: {
  organizationId: string | number;
  uploadedBy: number;
  fileName: string;
  fileKey: string;
  fileUrl?: string;
  fileType: string;
  fileSize: number;
  encryption: {
    algorithm: string;
    iv: string;
    authTag: string;
    keyVersion: number;
    isEncrypted: true;
  };
}) {
  const organizationId = normalizeOrganizationId(params.organizationId);
  return createDocument({
    name: params.fileName,
    description: JSON.stringify({ originalFileName: params.fileName }),
    fileUrl: params.fileUrl ?? "",
    fileKey: params.fileKey,
    fileType: params.fileType,
    fileSize: params.fileSize,
    entityType: "organization",
    entityId: null,
    organizationId,
    encryptionAlgorithm: params.encryption.algorithm,
    encryptionKeyVersion: params.encryption.keyVersion,
    encryptionIv: params.encryption.iv,
    encryptionAuthTag: params.encryption.authTag,
    encryptedAt: new Date(),
    isEncrypted: true,
    uploadedBy: params.uploadedBy,
  });
}

export async function getDocumentById(
  documentId: number,
  options?: { organizationId?: string | number }
) {
  const db = await getDb();
  if (!db) return null;
  const conditions = [eq(documents.id, documentId)];
  if (options?.organizationId !== undefined && options.organizationId !== null) {
    conditions.push(eq(documents.organizationId, normalizeOrganizationId(options.organizationId)));
  }
  const rows = await db.select().from(documents).where(and(...conditions)).limit(1);
  return rows[0] ?? null;
}

export async function getDocumentByFileKey(
  fileKey: string,
  options?: { organizationId?: string | number }
) {
  const db = await getDb();
  if (!db) return null;
  const normalizedFileKey = fileKey.trim();
  if (!normalizedFileKey) return null;

  const conditions = [eq(documents.fileKey, normalizedFileKey)];
  if (options?.organizationId !== undefined && options.organizationId !== null) {
    conditions.push(eq(documents.organizationId, normalizeOrganizationId(options.organizationId)));
  }

  const rows = await db
    .select()
    .from(documents)
    .where(and(...conditions))
    .orderBy(desc(documents.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function createInitialOrganizationEncryptionKey(organizationId: string | number) {
  const existing = await getActiveOrganizationEncryptionKey(organizationId);
  if (existing) return existing;
  const encryptedKey = encryptOrgDataKey(generateOrgDataKey());
  return createOrganizationEncryptionKey({
    organizationId,
    encryptedKey,
    keyVersion: 1,
    status: "active",
  });
}

export async function rotateOrganizationEncryptionKey(organizationId: string | number) {
  const active = await getActiveOrganizationEncryptionKey(organizationId);
  const nextVersion = active ? Number(active.keyVersion) + 1 : 1;
  const encryptedKey = encryptOrgDataKey(generateOrgDataKey());
  const created = await createOrganizationEncryptionKey({
    organizationId,
    encryptedKey,
    keyVersion: nextVersion,
    status: "active",
  });
  return {
    retiredVersion: active ? Number(active.keyVersion) : null,
    activeKeyVersion: created ? Number(created.keyVersion) : null,
    organizationId: created?.organizationId ?? normalizeOrganizationId(organizationId),
  };
}

export async function getOrganizationEncryptionKeyMaterial(
  organizationId: string | number,
  keyVersion?: number
) {
  const keyRecord = await getActiveOrganizationEncryptionKey(organizationId, keyVersion);
  if (!keyRecord) return null;
  return {
    organizationId: keyRecord.organizationId,
    keyVersion: keyRecord.keyVersion,
    algorithm: "aes-256-gcm",
    dataKey: decryptOrgDataKey(keyRecord.encryptedKey),
  };
}

// ============= DASHBOARD STATISTICS =============

export async function getDashboardStats() {
  const db = await getDb();
  if (!db) return null;
  
  const [totalAssets] = await db.select({ count: sql<number>`count(*)` }).from(assets);
  const [operationalAssets] = await db.select({ count: sql<number>`count(*)` }).from(assets).where(eq(assets.status, 'operational'));
  const [maintenanceAssets] = await db.select({ count: sql<number>`count(*)` }).from(assets).where(eq(assets.status, 'maintenance'));
  const [pendingWorkOrders] = await db.select({ count: sql<number>`count(*)` }).from(workOrders).where(eq(workOrders.status, 'pending'));
  const [inProgressWorkOrders] = await db.select({ count: sql<number>`count(*)` }).from(workOrders).where(eq(workOrders.status, 'in_progress'));
  const [lowStockCount] = await db.select({ count: sql<number>`count(*)` }).from(inventoryItems)
    .where(sql`${inventoryItems.currentStock} <= ${inventoryItems.reorderPoint}`);
  
  return {
    totalAssets: Number(totalAssets?.count ?? 0),
    operationalAssets: Number(operationalAssets?.count ?? 0),
    maintenanceAssets: Number(maintenanceAssets?.count ?? 0),
    pendingWorkOrders: Number(pendingWorkOrders?.count ?? 0),
    inProgressWorkOrders: Number(inProgressWorkOrders?.count ?? 0),
    lowStockItems: Number(lowStockCount?.count ?? 0),
  };
}

// ============= NOTIFICATIONS =============

export async function createNotification(notification: typeof notifications.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(notifications).values(notification).returning({ id: notifications.id });
  return Number(result[0]?.id ?? 0);
}

export async function getUserNotifications(userId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function getUnreadNotificationCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(and(
      eq(notifications.userId, userId),
      eq(notifications.isRead, false)
    ));
  return result[0]?.count || 0;
}

export async function markNotificationAsRead(id: number) {
  const db = await getDb();
  if (!db) return null;
  return await db.update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(eq(notifications.id, id));
}

export async function markAllNotificationsAsRead(userId: number) {
  const db = await getDb();
  if (!db) return null;
  return await db.update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(
      eq(notifications.userId, userId),
      eq(notifications.isRead, false)
    ));
}

export async function deleteNotification(id: number) {
  const db = await getDb();
  if (!db) return null;
  return await db.delete(notifications).where(eq(notifications.id, id));
}

// ============= NOTIFICATION PREFERENCES =============

export async function getUserNotificationPreferences(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);
  return result[0] || null;
}

export async function upsertNotificationPreferences(userId: number, prefs: Partial<typeof notificationPreferences.$inferInsert>) {
  const db = await getDb();
  if (!db) return null;
  
  const existing = await getUserNotificationPreferences(userId);
  
  if (existing) {
    return await db.update(notificationPreferences)
      .set(prefs)
      .where(eq(notificationPreferences.userId, userId));
  } else {
    return await db.insert(notificationPreferences).values({
      userId,
      ...prefs,
    });
  }
}


// ===== Asset Photos =====
export async function createAssetPhoto(data: InsertAssetPhoto) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(assetPhotos).values(data).returning({ id: assetPhotos.id });
  return Number(result[0]?.id ?? 0);
}

export async function getAssetPhotos(assetId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(assetPhotos).where(eq(assetPhotos.assetId, assetId));
}

export async function getWorkOrderPhotos(workOrderId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(assetPhotos).where(eq(assetPhotos.workOrderId, workOrderId));
}

export async function deleteAssetPhoto(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(assetPhotos).where(eq(assetPhotos.id, id));
}

// ===== Scheduled Reports =====
export async function createScheduledReport(data: InsertScheduledReport) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(scheduledReports).values(data).returning({ id: scheduledReports.id });
  return Number(result[0]?.id ?? 0);
}

export async function getScheduledReports() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(scheduledReports);
}

export async function getScheduledReportById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(scheduledReports).where(eq(scheduledReports.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateScheduledReport(id: number, data: Partial<InsertScheduledReport>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(scheduledReports).set(data).where(eq(scheduledReports.id, id));
}

export async function deleteScheduledReport(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(scheduledReports).where(eq(scheduledReports.id, id));
}

export async function getActiveScheduledReports() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(scheduledReports).where(eq(scheduledReports.isActive, true));
}


// ===== Additional User Management Functions =====
export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUser(id: number, data: Partial<InsertUser>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(users).set(data).where(eq(users.id, id));
  return { success: true };
}

export async function deleteUser(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(users).where(eq(users.id, id));
  return { success: true };
}


export async function getAssetByBarcode(barcode: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(assets).where(eq(assets.barcode, barcode)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}


export async function getAssetWorkOrders(assetId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(workOrders).where(eq(workOrders.assetId, assetId)).orderBy(desc(workOrders.createdAt));
}

export async function getWorkOrdersByAssetId(assetId: number) {
  return await getAssetWorkOrders(assetId);
}

/** Precomputed maintenance KPIs for an asset (counts, completion rate, avg duration). No client-side aggregation. */
export async function getMaintenanceSummary(assetId: number): Promise<{
  total: number;
  completed: number;
  completionRatePct: number;
  avgDurationDays: number | null;
}> {
  const db = await getDb();
  if (!db) return { total: 0, completed: 0, completionRatePct: 0, avgDurationDays: null };

  const [countRow] = await db
    .select({
      total: sql<number>`COUNT(*)`.as("total"),
      completed: sql<number>`SUM(CASE WHEN ${workOrders.status} = 'completed' THEN 1 ELSE 0 END)`.as("completed"),
    })
    .from(workOrders)
    .where(eq(workOrders.assetId, assetId));

  const total = Number(countRow?.total ?? 0);
  const completed = Number(countRow?.completed ?? 0);
  const completionRatePct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const [avgRow] = await db
    .select({
      avgDays: sql<number | null>`AVG(CASE
        WHEN ${workOrders.actualStart} IS NOT NULL AND ${workOrders.actualEnd} IS NOT NULL
        THEN DATEDIFF(${workOrders.actualEnd}, ${workOrders.actualStart})
        ELSE NULL
      END)`.as("avgDays"),
    })
    .from(workOrders)
    .where(eq(workOrders.assetId, assetId));

  const avgDurationDays = avgRow?.avgDays != null ? Number(Number(avgRow.avgDays).toFixed(1)) : null;

  return { total, completed, completionRatePct, avgDurationDays };
}

// ============= ASSET TRANSFERS =============

export async function createAssetTransfer(transfer: typeof assetTransfers.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(assetTransfers).values(transfer).returning({ id: assetTransfers.id });
  const insertId = result[0]?.id;
  if (!insertId || isNaN(Number(insertId))) throw new Error("Failed to get insert ID");
  return await db.select().from(assetTransfers).where(eq(assetTransfers.id, insertId)).limit(1).then(r => r[0]);
}

export async function getAllAssetTransfers(filters?: { status?: string; assetId?: number; siteId?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (filters?.status) conditions.push(eq(assetTransfers.status, filters.status as any));
  if (filters?.assetId) conditions.push(eq(assetTransfers.assetId, filters.assetId));
  if (filters?.siteId) conditions.push(
    or(eq(assetTransfers.fromSiteId, filters.siteId), eq(assetTransfers.toSiteId, filters.siteId))
  );
  
  if (conditions.length > 0) {
    return await db.select().from(assetTransfers)
      .where(and(...conditions))
      .orderBy(desc(assetTransfers.requestDate));
  }
  
  return await db.select().from(assetTransfers).orderBy(desc(assetTransfers.requestDate));
}

export async function getAssetTransferById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(assetTransfers).where(eq(assetTransfers.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateAssetTransfer(id: number, data: Partial<typeof assetTransfers.$inferInsert>) {
  const db = await getDb();
  if (!db) return null;
  await db.update(assetTransfers).set(data).where(eq(assetTransfers.id, id));
  return await db.select().from(assetTransfers).where(eq(assetTransfers.id, id)).limit(1).then(r => r[0] || null);
}

export async function getPendingTransferRequests() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(assetTransfers)
    .where(eq(assetTransfers.status, 'pending'))
    .orderBy(asc(assetTransfers.requestDate));
}


export async function getAssetByTag(assetTag: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(assets).where(eq(assets.assetTag, assetTag)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}


export async function getFinancialTransactionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(financialTransactions).where(eq(financialTransactions.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateFinancialTransaction(id: number, data: Partial<typeof financialTransactions.$inferInsert>) {
  const db = await getDb();
  if (!db) return null;
  await db.update(financialTransactions).set(data).where(eq(financialTransactions.id, id));
  return await getFinancialTransactionById(id);
}


// ============= QuickBooks Configuration =============
export async function getQuickBooksConfig() {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(quickbooksConfig).where(eq(quickbooksConfig.isActive, 1)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function saveQuickBooksConfig(config: InsertQuickBooksConfig) {
  const db = await getDb();
  if (!db) return undefined;
  
  // Deactivate all existing configs
  await db.update(quickbooksConfig).set({ isActive: 0 });
  
  // Insert new config
  const result = await db.insert(quickbooksConfig).values(config).returning({ id: quickbooksConfig.id });
  const insertId = result[0]?.id;
  if (!insertId) throw new Error("Failed to get insert ID");
  return await db.select().from(quickbooksConfig).where(eq(quickbooksConfig.id, Number(insertId))).limit(1).then(r => r[0]);
}

export async function updateQuickBooksTokens(id: number, accessToken: string, refreshToken: string, expiresAt: Date) {
  const db = await getDb();
  if (!db) return false;
  
  await db.update(quickbooksConfig)
    .set({ 
      accessToken, 
      refreshToken, 
      tokenExpiresAt: expiresAt 
    })
    .where(eq(quickbooksConfig.id, id));
  
  return true;
}

export async function updateQuickBooksLastSync(id: number) {
  const db = await getDb();
  if (!db) return false;
  
  await db.update(quickbooksConfig)
    .set({ lastSyncAt: new Date() })
    .where(eq(quickbooksConfig.id, id));
  
  return true;
}


// ============= User Preferences =============
export async function getUserPreferences(userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
  if (result.length > 0) {
    return result[0];
  }
  // Return default preferences with wide sidebar width (360px)
  return {
    userId,
    sidebarWidth: 360,
    sidebarCollapsed: 0,
    dashboardWidgets: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;
}

export async function upsertUserPreferences(prefs: InsertUserPreferences) {
  const db = await getDb();
  if (!db) return null;
  
  const existing = await getUserPreferences(prefs.userId);
  
  if (existing) {
    await db.update(userPreferences)
      .set({ ...prefs, updatedAt: new Date() })
      .where(eq(userPreferences.userId, prefs.userId));
    return await getUserPreferences(prefs.userId);
  } else {
    const result = await db.insert(userPreferences).values(prefs).returning({ id: userPreferences.id });
    const insertId = result[0]?.id;
    if (!insertId) throw new Error("Failed to get insert ID");
    return await db.select().from(userPreferences).where(eq(userPreferences.id, Number(insertId))).limit(1).then(r => r[0]);
  }
}


// ============= Email Notifications =============
export async function createEmailNotification(notification: InsertEmailNotification) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(emailNotifications).values(notification).returning({ id: emailNotifications.id });
  const insertId = result[0]?.id;
  if (!insertId) throw new Error("Failed to get insert ID");
  return await db.select().from(emailNotifications).where(eq(emailNotifications.id, Number(insertId))).limit(1).then(r => r[0]);
}

export async function getEmailNotificationHistory(limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(emailNotifications).orderBy(desc(emailNotifications.sentAt)).limit(limit);
}

export async function getEmailNotificationById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(emailNotifications).where(eq(emailNotifications.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getUserByEmail(email: string) {
  const database = getRootDb();
  if (!database) return null;

  const result = await database
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

/** Get app user by Supabase Auth user id (auth.users.id). */
export async function getUserBySupabaseUserId(supabaseUserId: string) {
  const database = getRootDb();
  if (!database) return undefined;
  const result = await database
    .select()
    .from(users)
    .where(eq(users.supabaseUserId, supabaseUserId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/** Create a user session row (device/session tracking). Returns session id or null. */
export async function createUserSession(params: {
  userId: string;
  userAgent?: string | null;
  ip?: string | null;
}): Promise<string | null> {
  const database = getRootDb();
  if (!database) return null;
  const [row] = await database
    .insert(userSessions)
    .values({
      userId: params.userId,
      userAgent: params.userAgent ?? null,
      ip: params.ip ?? null,
    })
    .returning({ id: userSessions.id });
  return row?.id ?? null;
}

/** Update last_seen_at for a session. No-op if session not found. */
export async function touchSessionLastSeen(sessionId: string): Promise<void> {
  const database = getRootDb();
  if (!database) return;
  await database
    .update(userSessions)
    .set({ lastSeenAt: new Date() })
    .where(eq(userSessions.id, sessionId));
}

/** Get session by id (for revoked check). */
export async function getSessionById(sessionId: string) {
  const database = getRootDb();
  if (!database) return null;
  const [row] = await database
    .select()
    .from(userSessions)
    .where(eq(userSessions.id, sessionId))
    .limit(1);
  return row ?? null;
}

/** List sessions for a user (Supabase user id). */
export async function listUserSessions(userId: string) {
  const database = getRootDb();
  if (!database) return [];
  return database
    .select()
    .from(userSessions)
    .where(eq(userSessions.userId, userId))
    .orderBy(desc(userSessions.lastSeenAt));
}

/** Mark session as revoked. */
export async function revokeSessionById(sessionId: string): Promise<void> {
  const database = getRootDb();
  if (!database) return;
  await database
    .update(userSessions)
    .set({ revoked: true })
    .where(eq(userSessions.id, sessionId));
}

/** Set supabase_user_id on an existing user (lazy migration / first Supabase login). */
export async function setUserSupabaseId(userId: number, supabaseUserId: string): Promise<void> {
  const database = getRootDb();
  if (!database) return;
  await database
    .update(users)
    .set({ supabaseUserId, lastSignedIn: new Date() })
    .where(eq(users.id, userId));
}

/** Mark user as MFA enrolled and set last verified; set mfa_enforced for global owners. */
export async function setUserMfaEnrolled(userId: number, isGlobalOwner: boolean): Promise<void> {
  const database = getRootDb();
  if (!database) return;
  const now = new Date();
  await database
    .update(users)
    .set({
      mfaEnabled: true,
      mfaLastVerifiedAt: now,
      ...(isGlobalOwner ? { mfaEnforced: true } : {}),
    })
    .where(eq(users.id, userId));
}

/** Refresh MFA last verified timestamp (e.g. after TOTP challenge at login or step-up). */
export async function setUserMfaVerifiedAt(userId: number): Promise<void> {
  const database = getRootDb();
  if (!database) return;
  await database
    .update(users)
    .set({ mfaLastVerifiedAt: new Date() })
    .where(eq(users.id, userId));
}

/**
 * Create an app user from a valid Supabase JWT payload when no user exists (e.g. test account or first login).
 * Uses sub as openId and supabase_user_id; status approved so they can log in immediately.
 */
export async function provisionUserFromSupabase(payload: { sub: string; email?: string }): Promise<typeof users.$inferSelect | null> {
  const database = getRootDb();
  if (!database) return null;
  const openId = payload.sub;
  const email = payload.email ?? "";
  const name = (email && email.includes("@")) ? email.split("@")[0] : "User";
  try {
    const result = await database
      .insert(users)
      .values({
        openId,
        email: email || null,
        name: name || null,
        supabaseUserId: payload.sub,
        status: "approved",
        role: "user",
        loginMethod: "supabase",
      } as any)
      .onConflictDoUpdate({
        target: users.openId,
        set: { supabaseUserId: payload.sub, lastSignedIn: new Date(), email: email || undefined, name: name || undefined },
      })
      .returning();
    return result[0] ?? null;
  } catch {
    const existing = await getUserBySupabaseUserId(payload.sub);
    return existing ?? null;
  }
}

/** Get Supabase user id for an app user (for cache invalidation). */
export async function getSupabaseUserIdByAppId(appUserId: number): Promise<string | null> {
  const database = getRootDb();
  if (!database) return null;
  const result = await database
    .select({ supabaseUserId: users.supabaseUserId })
    .from(users)
    .where(eq(users.id, appUserId))
    .limit(1);
  const sid = result[0]?.supabaseUserId;
  return typeof sid === "string" ? sid : null;
}

// ============= WORK ORDER TEMPLATES =============

export async function createWorkOrderTemplate(data: InsertWorkOrderTemplate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(workOrderTemplates).values(data).returning({ id: workOrderTemplates.id });
  return Number(result[0]?.id ?? 0);
}

export async function getWorkOrderTemplates(filters?: {
  isActive?: boolean;
  type?: string;
  categoryId?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (filters?.isActive !== undefined) {
    conditions.push(eq(workOrderTemplates.isActive, filters.isActive));
  }
  if (filters?.type) {
    conditions.push(eq(workOrderTemplates.type, filters.type as any));
  }
  if (filters?.categoryId) {
    conditions.push(eq(workOrderTemplates.categoryId, filters.categoryId));
  }
  
  if (conditions.length > 0) {
    return await db.select().from(workOrderTemplates).where(and(...conditions));
  }
  
  return await db.select().from(workOrderTemplates);
}

export async function getWorkOrderTemplateById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(workOrderTemplates).where(eq(workOrderTemplates.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateWorkOrderTemplate(id: number, data: Partial<InsertWorkOrderTemplate>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(workOrderTemplates).set(data).where(eq(workOrderTemplates.id, id));
}

export async function deleteWorkOrderTemplate(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(workOrderTemplates).set({ isActive: false }).where(eq(workOrderTemplates.id, id));
}


// ============= WARRANTY ALERTS =============

export async function getExpiringWarranties() {
  const db = await getDb();
  if (!db) return [];
  
  const now = new Date();
  const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  
  return await db
    .select()
    .from(assets)
    .where(
      and(
        isNotNull(assets.warrantyExpiry),
        lte(assets.warrantyExpiry, ninetyDaysFromNow),
        gte(assets.warrantyExpiry, now)
      )
    )
    .orderBy(asc(assets.warrantyExpiry));
}

// ============= AUDIT TRAIL =============

export async function logAuditEntry(entry: {
  userId: number;
  action: string;
  entityType?: string;
  entityId?: number;
  changes?: string;
}) {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(auditLogs).values({
    userId: entry.userId,
    action: entry.action,
    entityType: entry.entityType || null,
    entityId: entry.entityId || null,
    changes: entry.changes || null,
    ipAddress: null,
    userAgent: null,
  });
}

export async function getAssetAuditHistory(assetId: number) {
  return await getAuditLogs({ entityType: 'asset', entityId: assetId });
}


// ============= COST ANALYTICS =============

/** Cost analytics: all aggregation done in the database (no fetch-then-reduce). */
export async function getCostAnalytics(days: number) {
  const db = await getDb();
  if (!db) return null;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // 1) Totals by transaction type (single aggregated query)
  const typeRows = await db
    .select({
      transactionType: financialTransactions.transactionType,
      total: sql<number>`COALESCE(SUM(CAST(${financialTransactions.amount} AS DECIMAL(15,2))), 0)`.as("total"),
    })
    .from(financialTransactions)
    .where(gte(financialTransactions.transactionDate, startDate))
    .groupBy(financialTransactions.transactionType);

  let totalCost = 0;
  let maintenanceCost = 0;
  let repairCost = 0;
  for (const row of typeRows) {
    const t = Number(row.total);
    totalCost += t;
    if (row.transactionType === "maintenance") maintenanceCost = t;
    if (row.transactionType === "repair") repairCost = t;
  }

  // 2) By category: JOIN assets + assetCategories, aggregate in DB
  const byCategoryRows = await db
    .select({
      categoryId: assets.categoryId,
      categoryName: sql<string>`COALESCE(${assetCategories.name}, 'Unknown')`.as("categoryName"),
      total: sql<number>`SUM(CAST(${financialTransactions.amount} AS DECIMAL(15,2)))`.as("total"),
    })
    .from(financialTransactions)
    .innerJoin(assets, eq(financialTransactions.assetId, assets.id))
    .leftJoin(assetCategories, eq(assets.categoryId, assetCategories.id))
    .where(gte(financialTransactions.transactionDate, startDate))
    .groupBy(assets.categoryId, assetCategories.name);

  const byCategory = byCategoryRows.map((r) => ({
    categoryId: r.categoryId,
    categoryName: String(r.categoryName),
    total: Number(r.total),
  }));

  // 3) By site: JOIN assets + sites, aggregate in DB
  const bySiteRows = await db
    .select({
      siteId: assets.siteId,
      siteName: sql<string>`COALESCE(${sites.name}, 'Unknown')`.as("siteName"),
      total: sql<number>`SUM(CAST(${financialTransactions.amount} AS DECIMAL(15,2)))`.as("total"),
    })
    .from(financialTransactions)
    .innerJoin(assets, eq(financialTransactions.assetId, assets.id))
    .leftJoin(sites, eq(assets.siteId, sites.id))
    .where(gte(financialTransactions.transactionDate, startDate))
    .groupBy(assets.siteId, sites.name);

  const bySite = bySiteRows.map((r) => ({
    siteId: r.siteId,
    siteName: String(r.siteName),
    total: Number(r.total),
  }));

  // 4) By vendor: JOIN vendors, aggregate in DB (top 10 by total)
  const byVendorRows = await db
    .select({
      vendorId: financialTransactions.vendorId,
      vendorName: sql<string>`COALESCE(${vendors.name}, 'Unknown')`.as("vendorName"),
      total: sql<number>`SUM(CAST(${financialTransactions.amount} AS DECIMAL(15,2)))`.as("total"),
      transactionCount: sql<number>`COUNT(*)`.as("transactionCount"),
    })
    .from(financialTransactions)
    .leftJoin(vendors, eq(financialTransactions.vendorId, vendors.id))
    .where(
      and(
        gte(financialTransactions.transactionDate, startDate),
        isNotNull(financialTransactions.vendorId)
      )
    )
    .groupBy(financialTransactions.vendorId, vendors.name);

  const byVendor = byVendorRows
    .map((r) => ({
      vendorId: r.vendorId!,
      vendorName: String(r.vendorName),
      total: Number(r.total),
      transactionCount: Number(r.transactionCount),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return {
    totalCost,
    maintenanceCost,
    repairCost,
    byCategory,
    bySite,
    byVendor,
  };
}

export async function getAssetCategoryById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(assetCategories).where(eq(assetCategories.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getVendorById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(vendors).where(eq(vendors.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}


// ============= NRCS ASSET REGISTER HELPERS =============

/**
 * Get all branch codes for dropdowns
 */
export async function getAllBranchCodes() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(branchCodes).orderBy(asc(branchCodes.name));
}

/**
 * Get all category codes with depreciation info
 */
export async function getAllCategoryCodes() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(categoryCodes).orderBy(asc(categoryCodes.name));
}

/**
 * Get all sub-categories
 */
export async function getAllSubCategories() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(subCategories).orderBy(asc(subCategories.name));
}

/**
 * Get sub-categories filtered by type (Asset or Inventory)
 */
export async function getSubCategoriesByType(type: 'Asset' | 'Inventory') {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(subCategories)
    .where(or(
      eq(subCategories.categoryType, type),
      eq(subCategories.categoryType, 'Both')
    ))
    .orderBy(asc(subCategories.name));
}

/**
 * Generate next NRCS asset code
 * Format: NRCS_[BRANCH][CATEGORY][NUMBER]
 * Example: NRCS_NHQCO0001
 */
export async function generateAssetCode(branchCode: string, categoryCode: string): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  // Find the highest asset number for this branch+category combination
  const result = await db.select({ maxNum: sql<number>`MAX(${assets.assetNumber})` })
    .from(assets)
    .where(and(
      eq(assets.branchCode, branchCode),
      eq(assets.itemCategoryCode, categoryCode)
    ))
    .limit(1);
  
  const nextNumber = (result[0]?.maxNum || 0) + 1;
  const paddedNumber = String(nextNumber).padStart(4, '0');
  
  return `NRCS_${branchCode}${categoryCode}${paddedNumber}`;
}

/**
 * Calculate depreciated value based on NRCS standards
 * Uses straight-line depreciation method
 */
export function calculateDepreciatedValue(
  acquisitionCost: number,
  yearAcquired: number,
  depreciationRate: number
): number {
  const currentYear = new Date().getFullYear();
  const yearsElapsed = currentYear - yearAcquired;
  
  if (yearsElapsed <= 0) return acquisitionCost;
  
  const annualDepreciation = acquisitionCost * depreciationRate;
  const totalDepreciation = annualDepreciation * yearsElapsed;
  const depreciatedValue = acquisitionCost - totalDepreciation;
  
  // Value cannot go below zero
  return Math.max(0, depreciatedValue);
}

/**
 * Get category code by name (for lookups)
 */
export async function getCategoryCodeByName(name: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(categoryCodes)
    .where(eq(categoryCodes.name, name))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

/**
 * Get branch code by state name
 */
export async function getBranchCodeByState(state: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(branchCodes)
    .where(eq(branchCodes.state, state))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

// ============= ASSET EDIT HISTORY =============

export async function logAssetEdit(params: {
  assetId: number;
  userId: number;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
}) {
  const db = await getDb();
  if (!db) return null;
  
  await db.insert(assetEditHistory).values({
    assetId: params.assetId,
    userId: params.userId,
    fieldName: params.fieldName,
    oldValue: params.oldValue,
    newValue: params.newValue,
  });
}

export async function getAssetEditHistory(assetId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select({
    id: assetEditHistory.id,
    fieldName: assetEditHistory.fieldName,
    oldValue: assetEditHistory.oldValue,
    newValue: assetEditHistory.newValue,
    changedAt: assetEditHistory.changedAt,
    userId: assetEditHistory.userId,
    userName: users.name,
  })
    .from(assetEditHistory)
    .leftJoin(users, eq(assetEditHistory.userId, users.id))
    .where(eq(assetEditHistory.assetId, assetId))
    .orderBy(desc(assetEditHistory.changedAt));
}

// ============= USER VERIFICATION =============

export async function getPendingUsers() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(users)
    .where(sql`status IN ('pending', 'approved', 'rejected')`)
    .orderBy(desc(users.createdAt));
}

export async function approveUser(userId: number, approvedBy: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(users)
    .set({
      status: 'approved',
      approvedBy,
      approvedAt: new Date(),
    })
    .where(eq(users.id, userId));
  
  return { success: true };
}

export async function rejectUser(userId: number, reason?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(users)
    .set({
      status: 'rejected',
      rejectionReason: reason || 'Registration not approved',
    })
    .where(eq(users.id, userId));
  
  return { success: true };
}

export async function bulkApproveUsers(userIds: number[], approvedBy: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  for (const userId of userIds) {
    await db.update(users)
      .set({
        status: 'approved',
        approvedBy,
        approvedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }
  
  return { success: true, count: userIds.length };
}

export async function bulkRejectUsers(userIds: number[], reason?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  for (const userId of userIds) {
    await db.update(users)
      .set({
        status: 'rejected',
        rejectionReason: reason || 'Registration not approved',
      })
      .where(eq(users.id, userId));
  }
  
  return { success: true, count: userIds.length };
}

// ============= TELEMETRY & ANALYTICS =============

function hourStart(date: Date): Date {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  return d;
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export async function createTelemetryPoint(params: {
  tenantId: number;
  assetId: number;
  metric: string;
  value: number;
  timestamp?: Date;
}) {
  const db = await getDb();
  if (!db) return null;
  const ts = params.timestamp ?? new Date();
  const result = await db.insert(telemetryPoints).values({
    tenantId: params.tenantId,
    assetId: params.assetId,
    metric: params.metric,
    value: params.value.toString(),
    timestamp: ts,
  }).returning({ id: telemetryPoints.id });
  return Number(result[0]?.id ?? 0) || null;
}

export async function aggregateTelemetryHourly(params: {
  tenantId: number;
  assetId?: number;
  hour?: Date;
}) {
  const db = await getDb();
  if (!db) {
    return { processedPoints: 0, aggregateRowsUpserted: 0 };
  }

  const hour = params.hour ? hourStart(params.hour) : null;
  const start = hour ?? addHours(hourStart(new Date()), -24);
  const end = hour ? addHours(hour, 1) : new Date();

  const conditions = [
    eq(telemetryPoints.tenantId, params.tenantId),
    gte(telemetryPoints.timestamp, start),
    lte(telemetryPoints.timestamp, end),
  ];
  if (params.assetId) {
    conditions.push(eq(telemetryPoints.assetId, params.assetId));
  }

  const points = await db
    .select()
    .from(telemetryPoints)
    .where(and(...conditions))
    .orderBy(asc(telemetryPoints.timestamp));

  const grouped = new Map<
    string,
    { tenantId: number; assetId: number; metric: string; hourBucket: Date; sum: number; min: number; max: number; count: number }
  >();

  for (const point of points) {
    const bucket = hourStart(new Date(point.timestamp));
    const key = `${point.tenantId}:${point.assetId}:${point.metric}:${bucket.toISOString()}`;
    const numeric = Number(point.value);
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        tenantId: point.tenantId,
        assetId: point.assetId,
        metric: point.metric,
        hourBucket: bucket,
        sum: numeric,
        min: numeric,
        max: numeric,
        count: 1,
      });
      continue;
    }
    existing.sum += numeric;
    existing.count += 1;
    if (numeric < existing.min) existing.min = numeric;
    if (numeric > existing.max) existing.max = numeric;
  }

  let upserts = 0;
  for (const group of Array.from(grouped.values())) {
    await db
      .insert(telemetryAggregates)
      .values({
        tenantId: group.tenantId,
        assetId: group.assetId,
        metric: group.metric,
        hourBucket: group.hourBucket,
        avgValue: (group.sum / group.count).toString(),
        maxValue: group.max.toString(),
        minValue: group.min.toString(),
        count: group.count,
      })
      .onConflictDoUpdate({
        target: [
          telemetryAggregates.tenantId,
          telemetryAggregates.assetId,
          telemetryAggregates.metric,
          telemetryAggregates.hourBucket,
        ],
        set: {
          avgValue: (group.sum / group.count).toString(),
          maxValue: group.max.toString(),
          minValue: group.min.toString(),
          count: group.count,
          updatedAt: new Date(),
        },
      });
    upserts += 1;
  }

  return {
    processedPoints: points.length,
    aggregateRowsUpserted: upserts,
    windowStart: start,
    windowEnd: end,
  };
}

export async function getTelemetryAnomalyStats(tenantId: number, assetId: number) {
  const db = await getDb();
  if (!db) {
    return { anomalyCount: 0, anomalyRatio: 0 };
  }
  const now = new Date();
  const last24h = addHours(now, -24);
  const last7d = addHours(now, -24 * 7);

  const recent = await db
    .select()
    .from(telemetryPoints)
    .where(
      and(
        eq(telemetryPoints.tenantId, tenantId),
        eq(telemetryPoints.assetId, assetId),
        gte(telemetryPoints.timestamp, last24h)
      )
    );

  const baseline = await db
    .select()
    .from(telemetryPoints)
    .where(
      and(
        eq(telemetryPoints.tenantId, tenantId),
        eq(telemetryPoints.assetId, assetId),
        gte(telemetryPoints.timestamp, last7d),
        lte(telemetryPoints.timestamp, last24h)
      )
    );

  if (recent.length === 0 || baseline.length === 0) {
    return { anomalyCount: 0, anomalyRatio: 0 };
  }

  const baselineByMetric = new Map<string, number>();
  const baselineCountByMetric = new Map<string, number>();
  for (const p of baseline) {
    const current = baselineByMetric.get(p.metric) ?? 0;
    const count = baselineCountByMetric.get(p.metric) ?? 0;
    baselineByMetric.set(p.metric, current + Number(p.value));
    baselineCountByMetric.set(p.metric, count + 1);
  }

  let anomalies = 0;
  for (const p of recent) {
    const sum = baselineByMetric.get(p.metric);
    const count = baselineCountByMetric.get(p.metric);
    if (!sum || !count) continue;
    const baselineAvg = sum / count;
    const value = Number(p.value);
    if (value > baselineAvg * 1.2 || value < baselineAvg * 0.8) {
      anomalies += 1;
    }
  }

  return {
    anomalyCount: anomalies,
    anomalyRatio: recent.length > 0 ? anomalies / recent.length : 0,
  };
}

export async function createReportSnapshot(params: {
  tenantId: number;
  reportType: string;
  payload: unknown;
}) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(reportSnapshots).values({
    tenantId: params.tenantId,
    reportType: params.reportType,
    payloadJson: JSON.stringify(params.payload ?? {}),
    generatedAt: new Date(),
  }).returning({ id: reportSnapshots.id });
  return Number(result[0]?.id ?? 0) || null;
}

export async function createPredictiveScore(params: {
  tenantId: number;
  assetId: number;
  riskScore: number;
  factors: unknown;
}) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(predictiveScores).values({
    tenantId: params.tenantId,
    assetId: params.assetId,
    riskScore: params.riskScore,
    factorsJson: JSON.stringify(params.factors ?? {}),
    scoredAt: new Date(),
  }).returning({ id: predictiveScores.id });
  return Number(result[0]?.id ?? 0) || null;
}
