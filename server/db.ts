import { eq, and, desc, asc, gte, lte, sql, or, like, isNotNull, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
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
  inspectionTemplates, inspections, complianceRules, complianceEvents, slaMetrics, auditLogsV1,
  ruvectorMemories, primeAgentExecutions, stockForecasts, warehouseTransferRecommendations
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { logger } from "./_core/logger";

let _db: ReturnType<typeof drizzle> | null = null;
let _pgClient: ReturnType<typeof postgres> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _pgClient = postgres(process.env.DATABASE_URL, {
        max: 10,
        prepare: false,
      });
      _db = drizzle(_pgClient);
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

// ============= USER MANAGEMENT =============

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
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
  const db = await getDb();
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
  const insertId = Number(result[0]?.id ?? 0);
  if (!insertId || Number.isNaN(insertId)) throw new Error("Failed to get insert ID");
  return await db.select().from(sites).where(eq(sites.id, insertId)).limit(1).then(r => r[0]);
}

export async function getAllSites() {
  const db = await getDb();
  if (!db) return [];
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
  const insertId = Number(result[0]?.id ?? 0);
  if (!insertId || Number.isNaN(insertId)) throw new Error("Failed to get insert ID");
  return await db.select().from(assetCategories).where(eq(assetCategories.id, insertId)).limit(1).then(r => r[0]);
}

// ============= ASSETS MANAGEMENT =============

export async function createAsset(asset: InsertAsset) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(assets).values(asset).returning({ id: assets.id });
  const insertId = Number(result[0]?.id ?? 0);
  if (!insertId || Number.isNaN(insertId)) {
    throw new Error("Failed to get insert ID");
  }
  return await db.select().from(assets).where(eq(assets.id, insertId)).limit(1).then(r => r[0]);
}

export async function getAllAssets(filters?: { siteId?: number; status?: string; categoryId?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(assets);
  const conditions = [];
  
  if (filters?.siteId) conditions.push(eq(assets.siteId, filters.siteId));
  if (filters?.status) conditions.push(eq(assets.status, filters.status as any));
  if (filters?.categoryId) conditions.push(eq(assets.categoryId, filters.categoryId));
  
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
  const insertId = Number(result[0]?.id ?? 0);
  if (!insertId || Number.isNaN(insertId)) throw new Error("Failed to get insert ID");
  return await db.select().from(workOrders).where(eq(workOrders.id, insertId)).limit(1).then(r => r[0]);
}

export async function getAllWorkOrders(filters?: { siteId?: number; status?: string; assignedTo?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(workOrders);
  const conditions = [];
  
  if (filters?.siteId) conditions.push(eq(workOrders.siteId, filters.siteId));
  if (filters?.status) conditions.push(eq(workOrders.status, filters.status as any));
  if (filters?.assignedTo) conditions.push(eq(workOrders.assignedTo, filters.assignedTo));
  
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
  const result = await db
    .insert(maintenanceSchedules)
    .values(schedule)
    .returning({ id: maintenanceSchedules.id });
  const insertId = Number(result[0]?.id ?? 0);
  if (!insertId || Number.isNaN(insertId)) throw new Error("Failed to get insert ID");
  return await db.select().from(maintenanceSchedules).where(eq(maintenanceSchedules.id, insertId)).limit(1).then(r => r[0]);
}

export async function getAllMaintenanceSchedules(filters?: { assetId?: number; isActive?: boolean }) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(maintenanceSchedules);
  const conditions = [];
  
  if (filters?.assetId) conditions.push(eq(maintenanceSchedules.assetId, filters.assetId));
  if (filters?.isActive !== undefined) conditions.push(eq(maintenanceSchedules.isActive, filters.isActive));
  
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
  const insertId = Number(result[0]?.id ?? 0);
  if (!insertId || Number.isNaN(insertId)) throw new Error("Failed to get insert ID");
  return await db.select().from(inventoryItems).where(eq(inventoryItems.id, insertId)).limit(1).then(r => r[0]);
}

export async function getAllInventoryItems(siteId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  if (siteId) {
    return await db.select().from(inventoryItems).where(eq(inventoryItems.siteId, siteId)).orderBy(asc(inventoryItems.name));
  }
  
  return await db.select().from(inventoryItems).orderBy(asc(inventoryItems.name));
}

export async function getInventoryItemById(id: number) {
  const db = await getDb();
  if (!db) return null;
  return await db
    .select()
    .from(inventoryItems)
    .where(eq(inventoryItems.id, id))
    .limit(1)
    .then(r => r[0] ?? null);
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
  const result = await db.insert(inventoryTransactions).values(transaction);
  const insertId = (result as any).insertId;
  return await db.select().from(inventoryTransactions).where(eq(inventoryTransactions.id, Number(insertId))).limit(1).then(r => r[0]);
}

export async function getInventoryTransactions(itemId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(inventoryTransactions)
    .where(eq(inventoryTransactions.itemId, itemId))
    .orderBy(desc(inventoryTransactions.transactionDate));
}

// ============= VENDORS =============

export async function createVendor(vendor: InsertVendor) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(vendors).values(vendor).returning({ id: vendors.id });
  const insertId = Number(result[0]?.id ?? 0);
  if (!insertId || Number.isNaN(insertId)) throw new Error("Failed to get insert ID");
  return await db.select().from(vendors).where(eq(vendors.id, insertId)).limit(1).then(r => r[0]);
}

export async function getAllVendors() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(vendors).orderBy(asc(vendors.name));
}

export async function updateVendor(id: number, data: Partial<InsertVendor>) {
  const db = await getDb();
  if (!db) return null;
  await db.update(vendors).set(data).where(eq(vendors.id, id));
  return await db.select().from(vendors).where(eq(vendors.id, id)).limit(1).then(r => r[0] || null);
}

// ============= FINANCIAL TRANSACTIONS =============

export async function createFinancialTransaction(transaction: typeof financialTransactions.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(financialTransactions).values(transaction);
  const insertId = (result as any).insertId;
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

// ============= COMPLIANCE =============

export async function createComplianceRecord(record: typeof complianceRecords.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(complianceRecords).values(record);
  const insertId = (result as any).insertId;
  return await db.select().from(complianceRecords).where(eq(complianceRecords.id, Number(insertId))).limit(1).then(r => r[0]);
}

export async function getAllComplianceRecords(filters?: { assetId?: number; status?: string }) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(complianceRecords);
  const conditions = [];
  
  if (filters?.assetId) conditions.push(eq(complianceRecords.assetId, filters.assetId));
  if (filters?.status) conditions.push(eq(complianceRecords.status, filters.status as any));
  
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
  const result = await db.insert(documents).values(doc);
  const insertId = (result as any).insertId;
  return await db.select().from(documents).where(eq(documents.id, Number(insertId))).limit(1).then(r => r[0]);
}

export async function getDocuments(entityType?: string, entityId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  if (entityType && entityId) {
    return await db.select().from(documents)
      .where(and(eq(documents.entityType, entityType), eq(documents.entityId, entityId)))
      .orderBy(desc(documents.createdAt));
  }
  
  return await db.select().from(documents).orderBy(desc(documents.createdAt));
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
    totalAssets: Number(totalAssets?.count || 0),
    operationalAssets: Number(operationalAssets?.count || 0),
    maintenanceAssets: Number(maintenanceAssets?.count || 0),
    pendingWorkOrders: Number(pendingWorkOrders?.count || 0),
    inProgressWorkOrders: Number(inProgressWorkOrders?.count || 0),
    lowStockItems: Number(lowStockCount?.count || 0),
  };
}

// ============= NOTIFICATIONS =============

export async function createNotification(notification: typeof notifications.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(notifications).values(notification).returning({ id: notifications.id });
  return Number(result[0]?.id || 0);
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
  return Number(result[0]?.count || 0);
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
  
  const result = await db.insert(assetPhotos).values(data);
  const insertId = Number((result as any)[0]?.insertId || 0);
  return insertId;
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
  
  const result = await db.insert(scheduledReports).values(data);
  const insertId = Number((result as any)[0]?.insertId || 0);
  return insertId;
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


// ============= ASSET TRANSFERS =============

export async function createAssetTransfer(transfer: typeof assetTransfers.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(assetTransfers).values(transfer);
  const insertId = Number((result as any)[0]?.insertId || (result as any).insertId);
  if (!insertId || isNaN(insertId)) throw new Error("Failed to get insert ID");
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
  
  const result = await db.select().from(quickbooksConfig).where(eq(quickbooksConfig.isActive, true)).limit(1);
  if (result.length === 0) return null;
  const row = result[0] as any;
  return {
    ...row,
    isActive: row.isActive ? 1 : 0,
    autoSync: row.autoSync ? 1 : 0,
  };
}

export async function saveQuickBooksConfig(config: InsertQuickBooksConfig) {
  const db = await getDb();
  if (!db) return undefined;
  
  // Deactivate all existing configs
  await db.update(quickbooksConfig).set({ isActive: false });
  
  // Insert new config
  const result = await db
    .insert(quickbooksConfig)
    .values({
      ...config,
      isActive: Boolean((config as any).isActive),
      autoSync: Boolean((config as any).autoSync),
    } as InsertQuickBooksConfig)
    .returning({ id: quickbooksConfig.id });
  const insertId = Number(result[0]?.id ?? 0);
  
  const row = await db.select().from(quickbooksConfig).where(eq(quickbooksConfig.id, insertId)).limit(1).then(r => r[0]);
  if (!row) return row;
  return {
    ...row,
    isActive: (row as any).isActive ? 1 : 0,
    autoSync: (row as any).autoSync ? 1 : 0,
  } as any;
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
    const result = await db.insert(userPreferences).values(prefs);
    const insertId = (result as any)[0]?.insertId;
    return await db.select().from(userPreferences).where(eq(userPreferences.id, Number(insertId))).limit(1).then(r => r[0]);
  }
}


// ============= Email Notifications =============
export async function createEmailNotification(notification: InsertEmailNotification) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(emailNotifications).values(notification);
  const insertId = (result as any)[0]?.insertId;
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
  const database = await getDb();
  if (!database) return null;
  
  const result = await database
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}



// ============= WORK ORDER TEMPLATES =============

export async function createWorkOrderTemplate(data: InsertWorkOrderTemplate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(workOrderTemplates).values(data);
  return Number((result as any)[0]?.insertId || 0);
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

export async function getCostAnalytics(days: number) {
  const db = await getDb();
  if (!db) return null;
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  // Get all transactions in date range
  const transactions = await db
    .select()
    .from(financialTransactions)
    .where(gte(financialTransactions.transactionDate, startDate));
  
  // Calculate totals
  const totalCost = transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const maintenanceCost = transactions
    .filter(t => t.transactionType === 'maintenance')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const repairCost = transactions
    .filter(t => t.transactionType === 'repair')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  
  // Group by category
  const assetIds = Array.from(new Set(transactions.map(t => t.assetId).filter(Boolean)));
  const assetsList = await Promise.all(
    assetIds.map(id => getAssetById(id!))
  );
  
  const byCategory: Record<number, { categoryId: number; categoryName: string; total: number }> = {};
  for (const transaction of transactions) {
    if (transaction.assetId) {
      const asset = assetsList.find(a => a?.id === transaction.assetId);
      if (asset && asset.categoryId) {
        if (!byCategory[asset.categoryId]) {
          const category = await getAssetCategoryById(asset.categoryId);
          byCategory[asset.categoryId] = {
            categoryId: asset.categoryId,
            categoryName: category?.name || 'Unknown',
            total: 0,
          };
        }
        byCategory[asset.categoryId].total += parseFloat(transaction.amount);
      }
    }
  }
  
  // Group by site
  const bySite: Record<number, { siteId: number; siteName: string; total: number }> = {};
  for (const transaction of transactions) {
    if (transaction.assetId) {
      const asset = assetsList.find(a => a?.id === transaction.assetId);
      if (asset && asset.siteId) {
        if (!bySite[asset.siteId]) {
          const site = await getSiteById(asset.siteId);
          bySite[asset.siteId] = {
            siteId: asset.siteId,
            siteName: site?.name || 'Unknown',
            total: 0,
          };
        }
        bySite[asset.siteId].total += parseFloat(transaction.amount);
      }
    }
  }
  
  // Group by vendor
  const byVendor: Record<number, { vendorId: number; vendorName: string; total: number; transactionCount: number }> = {};
  for (const transaction of transactions) {
    if (transaction.vendorId) {
      if (!byVendor[transaction.vendorId]) {
        const vendor = await getVendorById(transaction.vendorId);
        byVendor[transaction.vendorId] = {
          vendorId: transaction.vendorId,
          vendorName: vendor?.name || 'Unknown',
          total: 0,
          transactionCount: 0,
        };
      }
      byVendor[transaction.vendorId].total += parseFloat(transaction.amount);
      byVendor[transaction.vendorId].transactionCount += 1;
    }
  }
  
  return {
    totalCost,
    maintenanceCost,
    repairCost,
    byCategory: Object.values(byCategory),
    bySite: Object.values(bySite),
    byVendor: Object.values(byVendor).sort((a, b) => b.total - a.total).slice(0, 10),
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
  });
  return Number((result as any)[0]?.insertId || (result as any).insertId || 0) || null;
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
  });
  return Number((result as any)[0]?.insertId || (result as any).insertId || 0) || null;
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
  });
  return Number((result as any)[0]?.insertId || (result as any).insertId || 0) || null;
}

export async function getPredictiveScoresByTenant(tenantId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(predictiveScores)
    .where(eq(predictiveScores.tenantId, tenantId))
    .orderBy(desc(predictiveScores.scoredAt))
    .limit(Math.min(Math.max(limit, 1), 1000));
}

// ============= PHASE 3A READ SCAFFOLDING =============

export async function getInspectionTemplatesByTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(inspectionTemplates)
    .where(eq(inspectionTemplates.tenantId, tenantId))
    .orderBy(desc(inspectionTemplates.createdAt));
}

export async function getInspectionTemplateByIdAndTenant(tenantId: number, templateId: number) {
  const db = await getDb();
  if (!db) return null;
  return await db
    .select()
    .from(inspectionTemplates)
    .where(and(eq(inspectionTemplates.tenantId, tenantId), eq(inspectionTemplates.id, templateId)))
    .limit(1)
    .then(r => r[0] ?? null);
}

export async function createInspectionTemplate(input: {
  tenantId: number;
  name: string;
  description?: string;
  checklistJson: string;
  frequency?: string;
}) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(inspectionTemplates).values({
    tenantId: input.tenantId,
    name: input.name,
    description: input.description,
    checklistJson: input.checklistJson,
    frequency: input.frequency ?? "monthly",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const insertId = Number((result as any)[0]?.insertId || (result as any).insertId);
  if (!insertId || isNaN(insertId)) return null;
  return await db
    .select()
    .from(inspectionTemplates)
    .where(eq(inspectionTemplates.id, insertId))
    .limit(1)
    .then(r => r[0] ?? null);
}

export async function getInspectionsByTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(inspections)
    .where(eq(inspections.tenantId, tenantId))
    .orderBy(desc(inspections.createdAt));
}

export async function findInspectionForTemplate(tenantId: number, assetId: number, templateId: number) {
  const db = await getDb();
  if (!db) return null;
  return await db
    .select()
    .from(inspections)
    .where(
      and(
        eq(inspections.tenantId, tenantId),
        eq(inspections.assetId, assetId),
        eq(inspections.templateId, templateId),
        or(eq(inspections.status, "scheduled"), eq(inspections.status, "in_progress"), eq(inspections.status, "completed"))
      )
    )
    .orderBy(desc(inspections.createdAt))
    .limit(1)
    .then(r => r[0] ?? null);
}

export async function getInspectionById(tenantId: number, inspectionId: number) {
  const db = await getDb();
  if (!db) return null;
  return await db
    .select()
    .from(inspections)
    .where(and(eq(inspections.tenantId, tenantId), eq(inspections.id, inspectionId)))
    .limit(1)
    .then(r => r[0] ?? null);
}

export async function getComplianceRulesByTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(complianceRules)
    .where(eq(complianceRules.tenantId, tenantId))
    .orderBy(desc(complianceRules.createdAt));
}

export async function getComplianceEventsByTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(complianceEvents)
    .where(eq(complianceEvents.tenantId, tenantId))
    .orderBy(desc(complianceEvents.detectedAt));
}

export async function findOpenComplianceEvent(params: {
  tenantId: number;
  assetId: number;
  ruleId: number;
  eventType: string;
}) {
  const db = await getDb();
  if (!db) return null;
  return await db
    .select()
    .from(complianceEvents)
    .where(
      and(
        eq(complianceEvents.tenantId, params.tenantId),
        eq(complianceEvents.assetId, params.assetId),
        eq(complianceEvents.ruleId, params.ruleId),
        eq(complianceEvents.eventType, params.eventType),
        eq(complianceEvents.status, "open")
      )
    )
    .orderBy(desc(complianceEvents.createdAt))
    .limit(1)
    .then(r => r[0] ?? null);
}

export async function getAuditLogsByTenant(tenantId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(auditLogsV1)
    .where(eq(auditLogsV1.tenantId, tenantId))
    .orderBy(desc(auditLogsV1.timestamp))
    .limit(limit);
}

export async function getAssetHealthSummary(tenantId: number) {
  const db = await getDb();
  if (!db) {
    return {
      tenantId,
      totalAssets: 0,
      averageRiskScore: 0,
      highRiskAssets: 0,
      computedAt: new Date().toISOString(),
    };
  }

  const scores = await db
    .select()
    .from(predictiveScores)
    .where(eq(predictiveScores.tenantId, tenantId));

  const totalAssets = scores.length;
  const totalRisk = scores.reduce((sum, row) => sum + row.riskScore, 0);
  const averageRiskScore = totalAssets > 0 ? totalRisk / totalAssets : 0;
  const highRiskAssets = scores.filter(row => row.riskScore >= 70).length;

  return {
    tenantId,
    totalAssets,
    averageRiskScore: Number(averageRiskScore.toFixed(2)),
    highRiskAssets,
    computedAt: new Date().toISOString(),
  };
}

export async function getMaintenanceBacklogSummary(tenantId: number) {
  const db = await getDb();
  if (!db) {
    return {
      tenantId,
      pending: 0,
      assigned: 0,
      inProgress: 0,
      onHold: 0,
      totalBacklog: 0,
      computedAt: new Date().toISOString(),
    };
  }

  const tenantInspections = await db
    .select()
    .from(inspections)
    .where(eq(inspections.tenantId, tenantId));

  const pending = tenantInspections.filter(i => i.status === "scheduled").length;
  const assigned = tenantInspections.filter(i => i.status === "in_progress").length;
  const inProgress = tenantInspections.filter(i => i.status === "in_progress").length;
  const onHold = tenantInspections.filter(i => i.status === "cancelled").length;

  return {
    tenantId,
    pending,
    assigned,
    inProgress,
    onHold,
    totalBacklog: pending + assigned + inProgress + onHold,
    computedAt: new Date().toISOString(),
  };
}

// ============= PHASE 4A - INTELLIGENCE FOUNDATION =============

export async function createRuVectorMemory(input: {
  tenantId: number;
  entityType: string;
  entityId?: number | null;
  eventType: string;
  vector: number[];
  metadata?: unknown;
}) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(ruvectorMemories).values({
    tenantId: input.tenantId,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    eventType: input.eventType,
    vectorJson: JSON.stringify(input.vector ?? []),
    metadataJson: JSON.stringify(input.metadata ?? {}),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return Number((result as any)[0]?.insertId || (result as any).insertId || 0) || null;
}

export async function listRuVectorMemoriesByTenant(input: {
  tenantId: number;
  eventType?: string;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const safeLimit = Math.min(Math.max(input.limit ?? 200, 1), 1000);
  let query = db
    .select()
    .from(ruvectorMemories)
    .where(eq(ruvectorMemories.tenantId, input.tenantId))
    .orderBy(desc(ruvectorMemories.createdAt))
    .limit(safeLimit);
  if (input.eventType) {
    query = db
      .select()
      .from(ruvectorMemories)
      .where(and(eq(ruvectorMemories.tenantId, input.tenantId), eq(ruvectorMemories.eventType, input.eventType)))
      .orderBy(desc(ruvectorMemories.createdAt))
      .limit(safeLimit);
  }
  return await query;
}

export async function createPrimeAgentExecution(input: {
  tenantId: number;
  agentType: string;
  status: "completed" | "no_action" | "failed";
  payload: unknown;
  output?: unknown;
  reasonTrace?: string;
}) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(primeAgentExecutions).values({
    tenantId: input.tenantId,
    agentType: input.agentType,
    status: input.status,
    inputPayload: JSON.stringify(input.payload ?? {}),
    outputPayload: JSON.stringify(input.output ?? {}),
    reasonTrace: input.reasonTrace ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return Number((result as any)[0]?.insertId || (result as any).insertId || 0) || null;
}

export async function createStockForecast(input: {
  tenantId: number;
  stockItemId: number;
  demandScore: number;
  recommendedAction: "no_action" | "monitor" | "prepare_procurement" | "reorder" | "emergency_restock";
  forecastTimestamp: Date;
  agentExecutionId?: number | null;
}) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(stockForecasts).values({
    tenantId: input.tenantId,
    stockItemId: input.stockItemId,
    demandScore: String(Number(input.demandScore.toFixed(4))),
    recommendedAction: input.recommendedAction,
    forecastTimestamp: input.forecastTimestamp,
    agentExecutionId: input.agentExecutionId ?? null,
    createdAt: new Date(),
  });
  return Number((result as any)[0]?.insertId || (result as any).insertId || 0) || null;
}

export async function getStockForecastsByTenant(input: {
  tenantId: number;
  stockItemId?: number;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const safeLimit = Math.min(Math.max(input.limit ?? 50, 1), 500);

  if (input.stockItemId) {
    return await db
      .select()
      .from(stockForecasts)
      .where(and(eq(stockForecasts.tenantId, input.tenantId), eq(stockForecasts.stockItemId, input.stockItemId)))
      .orderBy(desc(stockForecasts.forecastTimestamp))
      .limit(safeLimit);
  }

  return await db
    .select()
    .from(stockForecasts)
    .where(eq(stockForecasts.tenantId, input.tenantId))
    .orderBy(desc(stockForecasts.forecastTimestamp))
    .limit(safeLimit);
}

export async function createWarehouseTransferRecommendation(input: {
  tenantId: number;
  stockItemId: number;
  sourceWarehouseId: number;
  targetWarehouseId: number;
  transferQuantity: number;
  transferPriority: string;
  generatedAt?: Date;
  agentExecutionId?: number | null;
}) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(warehouseTransferRecommendations).values({
    tenantId: input.tenantId,
    stockItemId: input.stockItemId,
    sourceWarehouseId: input.sourceWarehouseId,
    targetWarehouseId: input.targetWarehouseId,
    transferQuantity: input.transferQuantity,
    transferPriority: input.transferPriority,
    generatedAt: input.generatedAt ?? new Date(),
    agentExecutionId: input.agentExecutionId ?? null,
    createdAt: new Date(),
  });
  return Number((result as any)[0]?.insertId || (result as any).insertId || 0) || null;
}

export async function listWarehouseTransferRecommendationsByTenant(input: {
  tenantId: number;
  stockItemId?: number;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const safeLimit = Math.min(Math.max(input.limit ?? 50, 1), 500);

  if (input.stockItemId !== undefined) {
    return await db
      .select()
      .from(warehouseTransferRecommendations)
      .where(
        and(
          eq(warehouseTransferRecommendations.tenantId, input.tenantId),
          eq(warehouseTransferRecommendations.stockItemId, input.stockItemId)
        )
      )
      .orderBy(desc(warehouseTransferRecommendations.generatedAt))
      .limit(safeLimit);
  }

  return await db
    .select()
    .from(warehouseTransferRecommendations)
    .where(eq(warehouseTransferRecommendations.tenantId, input.tenantId))
    .orderBy(desc(warehouseTransferRecommendations.generatedAt))
    .limit(safeLimit);
}

export async function findRecentStockForecast(input: {
  tenantId: number;
  stockItemId: number;
  lookbackMinutes?: number;
}) {
  const db = await getDb();
  if (!db) return null;
  const since = new Date(Date.now() - (input.lookbackMinutes ?? 5) * 60 * 1000);

  return await db
    .select()
    .from(stockForecasts)
    .where(
      and(
        eq(stockForecasts.tenantId, input.tenantId),
        eq(stockForecasts.stockItemId, input.stockItemId),
        gte(stockForecasts.forecastTimestamp, since)
      )
    )
    .orderBy(desc(stockForecasts.forecastTimestamp))
    .limit(1)
    .then(r => r[0] ?? null);
}

export async function findRecentWarehouseTransferRecommendation(input: {
  tenantId: number;
  stockItemId: number;
  sourceWarehouseId: number;
  targetWarehouseId: number;
  lookbackMinutes?: number;
}) {
  const db = await getDb();
  if (!db) return null;
  const since = new Date(Date.now() - (input.lookbackMinutes ?? 10) * 60 * 1000);

  return await db
    .select()
    .from(warehouseTransferRecommendations)
    .where(
      and(
        eq(warehouseTransferRecommendations.tenantId, input.tenantId),
        eq(warehouseTransferRecommendations.stockItemId, input.stockItemId),
        eq(warehouseTransferRecommendations.sourceWarehouseId, input.sourceWarehouseId),
        eq(warehouseTransferRecommendations.targetWarehouseId, input.targetWarehouseId),
        gte(warehouseTransferRecommendations.generatedAt, since)
      )
    )
    .orderBy(desc(warehouseTransferRecommendations.generatedAt))
    .limit(1)
    .then(r => r[0] ?? null);
}

export async function createInspection(input: {
  tenantId: number;
  assetId: number;
  templateId?: number | null;
  inspectionType: string;
  status: string;
  inspectorId?: number | null;
  scheduledAt?: Date;
  notes?: string;
}) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.insert(inspections).values({
    tenantId: input.tenantId,
    assetId: input.assetId,
    templateId: input.templateId ?? null,
    inspectionType: input.inspectionType,
    status: input.status,
    inspectorId: input.inspectorId ?? null,
    scheduledAt: input.scheduledAt ?? null,
    notes: input.notes ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const insertId = Number((result as any)[0]?.insertId || (result as any).insertId || 0);
  if (!insertId || isNaN(insertId)) return null;
  return await db
    .select()
    .from(inspections)
    .where(eq(inspections.id, insertId))
    .limit(1)
    .then(r => r[0] ?? null);
}

export async function getRecentReportSnapshot(tenantId: number, reportType: string, maxAgeMinutes = 10) {
  const db = await getDb();
  if (!db) return null;
  const since = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
  return await db
    .select()
    .from(reportSnapshots)
    .where(
      and(
        eq(reportSnapshots.tenantId, tenantId),
        eq(reportSnapshots.reportType, reportType),
        gte(reportSnapshots.generatedAt, since)
      )
    )
    .orderBy(desc(reportSnapshots.generatedAt))
    .limit(1)
    .then(r => r[0] ?? null);
}

export async function completeInspection(input: {
  tenantId: number;
  inspectionId: number;
  result: "pass" | "fail" | "needs_attention";
  notes?: string;
}) {
  const db = await getDb();
  if (!db) return null;

  await db
    .update(inspections)
    .set({
      status: "completed",
      result: input.result,
      notes: input.notes ?? null,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(inspections.id, input.inspectionId), eq(inspections.tenantId, input.tenantId)));

  return await db
    .select()
    .from(inspections)
    .where(and(eq(inspections.id, input.inspectionId), eq(inspections.tenantId, input.tenantId)))
    .limit(1)
    .then(r => r[0] ?? null);
}

export async function createComplianceEvent(input: {
  tenantId: number;
  assetId?: number;
  ruleId?: number;
  eventType: string;
  status?: string;
  detailsJson?: string;
}) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.insert(complianceEvents).values({
    tenantId: input.tenantId,
    assetId: input.assetId ?? null,
    ruleId: input.ruleId ?? null,
    eventType: input.eventType,
    status: input.status ?? "open",
    detailsJson: input.detailsJson ?? null,
    detectedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return Number((result as any)[0]?.insertId || (result as any).insertId || 0) || null;
}

export async function createSlaMetric(input: {
  tenantId: number;
  assetId?: number;
  metricType: string;
  targetValue?: number;
  actualValue?: number;
  periodStart: Date;
  periodEnd: Date;
}) {
  const db = await getDb();
  if (!db) return null;

  const metricConditions = [
    eq(slaMetrics.tenantId, input.tenantId),
    eq(slaMetrics.metricType, input.metricType),
    eq(slaMetrics.periodStart, input.periodStart),
    eq(slaMetrics.periodEnd, input.periodEnd),
  ];
  if (input.assetId === undefined) {
    metricConditions.push(isNull(slaMetrics.assetId));
  } else {
    metricConditions.push(eq(slaMetrics.assetId, input.assetId));
  }

  const existing = await db
    .select()
    .from(slaMetrics)
    .where(and(...metricConditions))
    .limit(1)
    .then(r => r[0] ?? null);
  if (existing) return existing.id;

  const result = await db.insert(slaMetrics).values({
    tenantId: input.tenantId,
    assetId: input.assetId ?? null,
    metricType: input.metricType,
    targetValue: input.targetValue?.toString() ?? null,
    actualValue: input.actualValue?.toString() ?? null,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return Number((result as any)[0]?.insertId || (result as any).insertId || 0) || null;
}
