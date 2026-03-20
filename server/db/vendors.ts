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

export async function getVendorById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(vendors).where(eq(vendors.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}