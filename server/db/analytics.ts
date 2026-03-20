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

export async function getInventoryConsumptionTrends(params?: {
  days?: number;
  siteId?: number;
  organizationId?: string | null;
}) {
  const db = await getDb();
  if (!db) return [];

  const days = Math.max(1, Math.min(365, params?.days ?? 30));
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const conditions = [
    eq(inventoryTransactions.type, "out"),
    gte(inventoryTransactions.transactionDate, startDate),
  ];

  if (params?.siteId) {
    conditions.push(eq(inventoryTransactions.fromSiteId, params.siteId));
  }
  if (params?.organizationId != null && params.organizationId !== "") {
    conditions.push(eq(inventoryItems.organizationId, normalizeOrganizationId(params.organizationId)));
  }

  const rows = await db
    .select({
      date: sql<string>`DATE(${inventoryTransactions.transactionDate})`.as("date"),
      consumption: sql<number>`COALESCE(SUM(${inventoryTransactions.quantity}), 0)`.as("consumption"),
    })
    .from(inventoryTransactions)
    .innerJoin(inventoryItems, eq(inventoryTransactions.itemId, inventoryItems.id))
    .where(and(...conditions))
    .groupBy(sql`DATE(${inventoryTransactions.transactionDate})`)
    .orderBy(asc(sql`DATE(${inventoryTransactions.transactionDate})`));

  return rows.map((row) => ({
    date: row.date,
    consumption: Number(row.consumption),
  }));
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
