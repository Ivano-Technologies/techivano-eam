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

export async function getAssetByBarcode(barcode: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(assets).where(eq(assets.barcode, barcode)).limit(1);
  return result.length > 0 ? result[0] : undefined;
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

export async function getAssetCategoryById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(assetCategories).where(eq(assetCategories.id, id)).limit(1);
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