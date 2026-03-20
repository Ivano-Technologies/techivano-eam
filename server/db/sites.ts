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

export async function deleteSite(id: number) {
  const db = await getDb();
  if (!db) return false;
  await db.delete(sites).where(eq(sites.id, id));
  return true;
}