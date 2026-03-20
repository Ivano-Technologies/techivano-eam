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
