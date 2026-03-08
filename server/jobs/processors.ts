import * as db from "../db";
import {
  autoCreatePreventiveWorkOrders,
} from "../predictiveMaintenance";
import { generateAnalyticsSnapshot } from "../modules/analytics/analyticsService";
import { evaluateComplianceForAsset } from "../modules/compliance/complianceService";
import { completeInspection, scheduleInspection } from "../modules/inspections/inspectionService";
import { calculateSlaForAsset } from "../modules/sla/slaService";
import {
  allocateInventory,
  detectStockAnomalies,
  predictStockDemand,
  recommendStockSubstitution,
} from "../modules/stock/stockIntelligenceService";
import { evaluateVendorPerformance } from "../modules/vendor/vendorIntelligenceService";
import { optimizeWarehouseLayout, rebalanceWarehouseStock } from "../modules/warehouse/warehouseIntelligenceService";
import type {
  BackgroundJobPayload,
  BackgroundJobName,
  ComplianceEvaluateJobPayload,
  InspectionEvaluateJobPayload,
  InspectionScheduleJobPayload,
  PmEvaluationJobPayload,
  PredictiveScoringJobPayload,
  ReportAnalyticsJobPayload,
  ReportGenerationJobPayload,
  SlaCalculationJobPayload,
  StockAllocateInventoryJobPayload,
  StockDetectAnomaliesJobPayload,
  StockPredictDemandJobPayload,
  StockRecommendSubstitutionJobPayload,
  TelemetryAggregationJobPayload,
  VendorEvaluatePerformanceJobPayload,
  WarehouseOptimizeLayoutJobPayload,
  WarehouseRebalanceStockJobPayload,
} from "./types";

export async function processJob(jobName: BackgroundJobName, payload: BackgroundJobPayload) {
  switch (jobName) {
    case "pm-evaluation":
      return processPmEvaluation(payload as PmEvaluationJobPayload);
    case "predictive.scoreAssets":
      return processPredictiveScoring(payload as PredictiveScoringJobPayload);
    case "reports.generateSnapshot":
      return processReportGeneration(payload as ReportGenerationJobPayload);
    case "telemetry.aggregateHourly":
      return processTelemetryAggregation(payload as TelemetryAggregationJobPayload);
    case "inspection.schedule":
      return processInspectionSchedule(payload as InspectionScheduleJobPayload);
    case "inspection.evaluate":
      return processInspectionEvaluate(payload as InspectionEvaluateJobPayload);
    case "compliance.evaluate":
      return processComplianceEvaluate(payload as ComplianceEvaluateJobPayload);
    case "sla.calculate":
      return processSlaCalculate(payload as SlaCalculationJobPayload);
    case "report.generateAnalytics":
      return processReportGenerateAnalytics(payload as ReportAnalyticsJobPayload);
    case "stock.predictDemand":
      return processStockPredictDemand(payload as StockPredictDemandJobPayload);
    case "stock.recommendSubstitution":
      return processStockRecommendSubstitution(payload as StockRecommendSubstitutionJobPayload);
    case "stock.allocateInventory":
      return processStockAllocateInventory(payload as StockAllocateInventoryJobPayload);
    case "stock.detectAnomalies":
      return processStockDetectAnomalies(payload as StockDetectAnomaliesJobPayload);
    case "warehouse.optimizeLayout":
      return processWarehouseOptimizeLayout(payload as WarehouseOptimizeLayoutJobPayload);
    case "warehouse.rebalanceStock":
      return processWarehouseRebalanceStock(payload as WarehouseRebalanceStockJobPayload);
    case "vendor.evaluatePerformance":
      return processVendorEvaluatePerformance(payload as VendorEvaluatePerformanceJobPayload);
    default:
      return { success: false, message: "Unknown background job" };
  }
}

async function processPmEvaluation(payload: PmEvaluationJobPayload) {
  const actorUserId = payload.actorUserId ?? payload.requestedBy ?? 1;
  const workOrderIds = await autoCreatePreventiveWorkOrders(actorUserId);
  return {
    success: true,
    tenantId: payload.tenantId,
    createdWorkOrderCount: workOrderIds.length,
    createdWorkOrderIds: workOrderIds,
  };
}

async function processPredictiveScoring(payload: PredictiveScoringJobPayload) {
  const assets = payload.assetId
    ? [await db.getAssetById(payload.assetId)].filter(Boolean)
    : await db.getAllAssets({ status: "operational" });

  const scores: Array<{ assetId: number; riskScore: number; factors: Record<string, unknown> }> = [];

  for (const asset of assets) {
    if (!asset) continue;

    const acquisitionDate = asset.acquisitionDate ? new Date(asset.acquisitionDate) : null;
    const ageYears = acquisitionDate
      ? Math.max(0, (Date.now() - acquisitionDate.getTime()) / (1000 * 60 * 60 * 24 * 365))
      : 0;

    const workOrders = await db.getAssetWorkOrders(asset.id);
    const maintenanceEvents = workOrders.filter(
      wo => wo.type === "preventive" || wo.type === "corrective" || wo.type === "inspection"
    );
    const downtimeEvents = workOrders.filter(wo => wo.status === "on_hold" || wo.status === "in_progress");
    const telemetryAnomalies = await db.getTelemetryAnomalyStats(payload.tenantId, asset.id);

    const ageScore = Math.min(30, ageYears * 6);
    const maintenanceFrequencyScore = Math.min(25, maintenanceEvents.length * 3);
    const downtimeScore = Math.min(25, downtimeEvents.length * 6);
    const anomalyScore = Math.min(20, telemetryAnomalies.anomalyRatio * 100);
    const riskScore = Math.round(Math.min(100, ageScore + maintenanceFrequencyScore + downtimeScore + anomalyScore));

    const factors = {
      assetAgeYears: Number(ageYears.toFixed(2)),
      maintenanceFrequency: maintenanceEvents.length,
      downtimeEvents: downtimeEvents.length,
      telemetryAnomalyRatio: Number(telemetryAnomalies.anomalyRatio.toFixed(4)),
      telemetryAnomalyCount: telemetryAnomalies.anomalyCount,
      ageScore: Number(ageScore.toFixed(2)),
      maintenanceFrequencyScore,
      downtimeScore,
      anomalyScore: Number(anomalyScore.toFixed(2)),
    };

    await db.createPredictiveScore({
      tenantId: payload.tenantId,
      assetId: asset.id,
      riskScore,
      factors,
    });

    scores.push({
      assetId: asset.id,
      riskScore,
      factors,
    });
  }

  return {
    success: true,
    tenantId: payload.tenantId,
    scoredAssets: scores.length,
    scores,
  };
}

async function processReportGeneration(payload: ReportGenerationJobPayload) {
  let snapshot: unknown;

  if (payload.reportType === "lifecycle-cost") {
    snapshot = await db.getCostAnalytics(30);
  } else if (payload.reportType === "maintenance-backlog") {
    const workOrders = await db.getAllWorkOrders();
    const backlog = workOrders.filter(wo => ["pending", "assigned", "in_progress", "on_hold"].includes(wo.status));
    snapshot = {
      totalBacklog: backlog.length,
      byPriority: {
        critical: backlog.filter(wo => wo.priority === "critical").length,
        high: backlog.filter(wo => wo.priority === "high").length,
        medium: backlog.filter(wo => wo.priority === "medium").length,
        low: backlog.filter(wo => wo.priority === "low").length,
      },
    };
  } else if (payload.reportType === "downtime-analytics") {
    const workOrders = await db.getAllWorkOrders();
    let downtimeHours = 0;
    for (const wo of workOrders) {
      if (wo.actualStart && wo.actualEnd) {
        downtimeHours +=
          (new Date(wo.actualEnd).getTime() - new Date(wo.actualStart).getTime()) / (1000 * 60 * 60);
      }
    }
    snapshot = {
      totalDowntimeHours: Number(downtimeHours.toFixed(2)),
      averageDowntimeHoursPerWorkOrder: workOrders.length > 0 ? Number((downtimeHours / workOrders.length).toFixed(2)) : 0,
    };
  } else {
    const assets = await db.getAllAssets();
    const runtimeAgg = await db.aggregateTelemetryHourly({
      tenantId: payload.tenantId,
    });
    snapshot = {
      totalAssets: assets.length,
      operationalAssets: assets.filter(a => a.status === "operational").length,
      telemetryWindow: runtimeAgg,
    };
  }

  const snapshotId = await db.createReportSnapshot({
    tenantId: payload.tenantId,
    reportType: payload.reportType,
    payload: snapshot,
  });

  return {
    success: true,
    tenantId: payload.tenantId,
    reportType: payload.reportType,
    snapshotId,
    snapshot,
  };
}

async function processTelemetryAggregation(payload: TelemetryAggregationJobPayload) {
  const aggregationHour = payload.hour ? new Date(payload.hour) : undefined;
  const aggregated = await db.aggregateTelemetryHourly({
    tenantId: payload.tenantId,
    assetId: payload.assetId,
    hour: aggregationHour,
  });

  return {
    success: true,
    tenantId: payload.tenantId,
    assetId: payload.assetId ?? null,
    hour: aggregationHour?.toISOString() ?? null,
    ...aggregated,
  };
}

async function processInspectionSchedule(payload: InspectionScheduleJobPayload) {
  const created = await scheduleInspection({
    tenantId: payload.tenantId,
    assetId: payload.assetId,
    templateId: payload.templateId,
    inspectionType: "scheduled",
    inspectorId: payload.requestedBy ?? null,
    scheduledAt: new Date(),
  });

  return {
    success: true,
    tenantId: payload.tenantId,
    inspectionId: created?.id ?? null,
    created: Boolean(created),
  };
}

async function processInspectionEvaluate(payload: InspectionEvaluateJobPayload) {
  const inspections = await db.getInspectionsByTenant(payload.tenantId);
  const latestForAsset = inspections
    .filter(row => row.assetId === payload.assetId)
    .sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    })[0];

  if (latestForAsset?.status === "completed") {
    return {
      success: true,
      tenantId: payload.tenantId,
      evaluated: true,
      idempotent: true,
      inspectionId: latestForAsset.id,
      result: latestForAsset.result ?? null,
    };
  }

  const latest = inspections
    .filter(row => row.assetId === payload.assetId && row.status !== "completed")
    .sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    })[0];

  if (!latest) {
    return {
      success: true,
      tenantId: payload.tenantId,
      evaluated: false,
      reason: "No pending inspections for asset",
    };
  }

  const completed = await completeInspection({
    tenantId: payload.tenantId,
    inspectionId: latest.id,
    result: "pass",
  });

  return {
    success: true,
    tenantId: payload.tenantId,
    evaluated: Boolean(completed),
    inspectionId: completed?.id ?? null,
    result: completed?.result ?? null,
  };
}

async function processComplianceEvaluate(payload: ComplianceEvaluateJobPayload) {
  const result = await evaluateComplianceForAsset({
    tenantId: payload.tenantId,
    assetId: payload.assetId,
  });

  return {
    success: true,
    tenantId: payload.tenantId,
    assetId: payload.assetId,
    ...result,
  };
}

async function processSlaCalculate(payload: SlaCalculationJobPayload) {
  const result = await calculateSlaForAsset({
    tenantId: payload.tenantId,
    assetId: payload.assetId,
  });

  return {
    success: true,
    tenantId: payload.tenantId,
    assetId: payload.assetId,
    ...result,
  };
}

async function processReportGenerateAnalytics(payload: ReportAnalyticsJobPayload) {
  const snapshot = await generateAnalyticsSnapshot({
    tenantId: payload.tenantId,
    reportType: payload.reportType,
  });

  return {
    success: true,
    tenantId: payload.tenantId,
    reportType: payload.reportType,
    ...snapshot,
  };
}

async function processStockPredictDemand(payload: StockPredictDemandJobPayload) {
  return await predictStockDemand({
    tenantId: payload.tenantId,
    stockItemId: payload.stockItemId,
    horizonDays: payload.horizonDays,
    requestedBy: payload.requestedBy,
  });
}

async function processStockRecommendSubstitution(payload: StockRecommendSubstitutionJobPayload) {
  return await recommendStockSubstitution({
    tenantId: payload.tenantId,
    itemId: payload.itemId,
    assetId: payload.assetId,
    requestedBy: payload.requestedBy,
  });
}

async function processStockAllocateInventory(payload: StockAllocateInventoryJobPayload) {
  return await allocateInventory({
    tenantId: payload.tenantId,
    workOrderId: payload.workOrderId,
    assetId: payload.assetId,
    requestedBy: payload.requestedBy,
  });
}

async function processStockDetectAnomalies(payload: StockDetectAnomaliesJobPayload) {
  return await detectStockAnomalies({
    tenantId: payload.tenantId,
    warehouseId: payload.warehouseId,
    requestedBy: payload.requestedBy,
  });
}

async function processWarehouseOptimizeLayout(payload: WarehouseOptimizeLayoutJobPayload) {
  return await optimizeWarehouseLayout({
    tenantId: payload.tenantId,
    warehouseId: payload.warehouseId,
    requestedBy: payload.requestedBy,
  });
}

async function processWarehouseRebalanceStock(payload: WarehouseRebalanceStockJobPayload) {
  return await rebalanceWarehouseStock({
    tenantId: payload.tenantId,
    warehouseId: payload.warehouseId,
    stockItemId: payload.stockItemId,
    requestedBy: payload.requestedBy,
    limit: payload.limit,
  });
}

async function processVendorEvaluatePerformance(payload: VendorEvaluatePerformanceJobPayload) {
  return await evaluateVendorPerformance({
    tenantId: payload.tenantId,
    vendorId: payload.vendorId,
    requestedBy: payload.requestedBy,
  });
}
