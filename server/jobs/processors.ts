import * as db from "../db";
import {
  autoCreatePreventiveWorkOrders,
} from "../predictiveMaintenance";
import type {
  BackgroundJobPayload,
  BackgroundJobName,
  PmEvaluationJobPayload,
  PredictiveScoringJobPayload,
  ReportGenerationJobPayload,
  TelemetryAggregationJobPayload,
  WarehouseRebalanceJobPayload,
  VendorRiskScoringJobPayload,
  ProcurementRecommendationJobPayload,
  SupplyChainRiskEvaluationJobPayload,
  DispatchOptimizationJobPayload,
  ExecutiveMetricsJobPayload,
} from "./types";
import {
  analyticsService,
  complianceService,
  dispatchOptimizationService,
  executiveIntelligenceService,
  inspectionService,
  procurementService,
  slaService,
  supplyChainRiskService,
  stockIntelligenceService,
  vendorIntelligenceService,
  warehouseIntelligenceService
} from "../modules";

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
    case "warehouse.rebalanceStock":
      return processWarehouseRebalance(payload as WarehouseRebalanceJobPayload);
    case "vendor.computeRiskScores":
      return processVendorRiskScoring(payload as VendorRiskScoringJobPayload);
    case "procurement.generateRecommendations":
      return processProcurementRecommendations(payload as ProcurementRecommendationJobPayload);
    case "supplychain.evaluateRisk":
      return processSupplyChainRiskEvaluation(payload as SupplyChainRiskEvaluationJobPayload);
    case "dispatch.optimizeAssignments":
      return processDispatchOptimization(payload as DispatchOptimizationJobPayload);
    case "executive.computeMetrics":
      return processExecutiveMetrics(payload as ExecutiveMetricsJobPayload);
    default:
      return { success: false, message: "Unknown background job" };
  }
}

async function processPmEvaluation(payload: PmEvaluationJobPayload) {
  void analyticsService;
  void complianceService;
  void inspectionService;
  void slaService;
  void stockIntelligenceService;
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

async function processWarehouseRebalance(payload: WarehouseRebalanceJobPayload) {
  const metrics = await db.getInventoryWarehouseMetrics(payload.tenantId, payload.stockItemId);
  const plan = await warehouseIntelligenceService.computeTransferPlan({
    tenantId: payload.tenantId,
    stockItemId: payload.stockItemId,
    metrics,
  });

  const agentExecutionId = `run-${payload.runId ?? "manual"}`;
  const persisted = await db.upsertWarehouseTransferRecommendations({
    tenantId: payload.tenantId,
    recommendations: plan.recommendations.map((reco) => ({
      stockItemId: reco.stockItemId,
      sourceWarehouseId: reco.sourceWarehouseId,
      targetWarehouseId: reco.targetWarehouseId,
      transferQuantity: reco.transferQuantity,
      transferPriority: reco.transferPriority,
      pressureScore: reco.pressureScore,
      agentExecutionId,
    })),
  });

  return {
    success: true,
    tenantId: payload.tenantId,
    stockItemId: payload.stockItemId,
    warehousesEvaluated: metrics.length,
    recommendationsGenerated: plan.recommendations.length,
    recommendationsPersisted: persisted,
    adjustment: plan.adjustment,
  };
}

async function processVendorRiskScoring(payload: VendorRiskScoringJobPayload) {
  const allSignals = await db.getVendorScoringInputs(payload.tenantId);
  const scopedSignals = payload.vendorId
    ? allSignals.filter((signal) => signal.vendorId === payload.vendorId)
    : allSignals;

  const evaluated = await vendorIntelligenceService.evaluateVendorIntelligence(scopedSignals);
  const agentExecutionId = `run-${payload.runId ?? "manual"}`;
  const persisted = await db.upsertVendorIntelligenceSnapshots({
    tenantId: payload.tenantId,
    performance: evaluated.performance.map((row) => ({
      vendorId: row.vendorId,
      deliveryReliability: row.deliveryReliability,
      costVariance: row.costVariance,
      leadTimeStability: row.leadTimeStability,
      defectRate: row.defectRate,
      vendorScore: row.vendorScore,
      agentExecutionId,
    })),
    risks: evaluated.risks.map((row) => ({
      vendorId: row.vendorId,
      vendorScore: row.vendorScore,
      riskScore: row.riskScore,
      riskBand: row.riskBand,
      agentExecutionId,
    })),
  });

  return {
    success: true,
    tenantId: payload.tenantId,
    vendorsEvaluated: scopedSignals.length,
    performanceRowsPersisted: persisted.performanceRows,
    riskRowsPersisted: persisted.riskRows,
  };
}

async function processProcurementRecommendations(payload: ProcurementRecommendationJobPayload) {
  const signals = await db.getProcurementInputSignals({
    tenantId: payload.tenantId,
    stockItemId: payload.stockItemId,
  });
  const recommendations = procurementService.generateProcurementRecommendations(signals);
  const agentExecutionId = `run-${payload.runId ?? "manual"}`;
  const persisted = await db.upsertProcurementRecommendations({
    tenantId: payload.tenantId,
    recommendations: recommendations.map((row) => ({
      stockItemId: row.stockItemId,
      recommendedVendorId: row.recommendedVendorId,
      recommendedQuantity: row.recommendedQuantity,
      demandScore: row.demandScore,
      vendorRiskScore: row.vendorRiskScore,
      procurementPriority: row.procurementPriority,
      agentExecutionId,
    })),
  });

  return {
    success: true,
    tenantId: payload.tenantId,
    stockItemId: payload.stockItemId ?? null,
    recommendationsGenerated: recommendations.length,
    recommendationsPersisted: persisted,
  };
}

async function processSupplyChainRiskEvaluation(payload: SupplyChainRiskEvaluationJobPayload) {
  const inputs = await db.getSupplyChainRiskInputs({
    tenantId: payload.tenantId,
    stockItemId: payload.stockItemId,
    vendorId: payload.vendorId,
  });
  const scores = supplyChainRiskService.evaluateRiskBatch(inputs);
  const agentExecutionId = `run-${payload.runId ?? "manual"}`;
  const persisted = await db.upsertSupplyChainRiskSnapshots({
    tenantId: payload.tenantId,
    scores: scores.map((row) => ({
      stockItemId: row.stockItemId,
      vendorId: row.vendorId,
      demandVolatility: row.demandVolatility,
      leadTimeRisk: row.leadTimeRisk,
      vendorRisk: row.vendorRisk,
      transportRisk: row.transportRisk,
      inventoryPressure: row.inventoryPressure,
      riskIndex: row.riskIndex,
      riskBand: row.riskBand,
      agentExecutionId,
    })),
  });

  return {
    success: true,
    tenantId: payload.tenantId,
    stockItemId: payload.stockItemId ?? null,
    vendorId: payload.vendorId ?? null,
    riskScoresGenerated: scores.length,
    riskScoresPersisted: persisted.scoreRows,
    riskEventsPersisted: persisted.eventRows,
  };
}

async function processDispatchOptimization(payload: DispatchOptimizationJobPayload) {
  const options = await db.getDispatchOptimizationInputs({
    tenantId: payload.tenantId,
    workOrderId: payload.workOrderId,
    facilityId: payload.facilityId,
  });
  const assignments = dispatchOptimizationService.evaluateDispatchOptions(options);
  const agentExecutionId = `run-${payload.runId ?? "manual"}`;
  const persisted = await db.upsertDispatchAssignments({
    tenantId: payload.tenantId,
    assignments: assignments.map((row) => ({
      workOrderId: row.workOrderId,
      technicianId: row.technicianId,
      fleetUnitId: row.fleetUnitId,
      dispatchPriority: row.dispatchPriority,
      estimatedTravelTime: row.estimatedTravelTime,
      routeDistance: row.routeDistance,
      dispatchScore: row.dispatchScore,
      agentExecutionId,
    })),
  });

  return {
    success: true,
    tenantId: payload.tenantId,
    workOrderId: payload.workOrderId ?? null,
    facilityId: payload.facilityId ?? null,
    assignmentsGenerated: assignments.length,
    assignmentsPersisted: persisted,
  };
}

async function processExecutiveMetrics(payload: ExecutiveMetricsJobPayload) {
  const inputs = await db.getExecutiveMetricsInputs(payload.tenantId);
  const snapshot = executiveIntelligenceService.buildExecutiveMetricsSnapshot(inputs);
  const snapshotDate = payload.snapshotDate ? new Date(payload.snapshotDate) : new Date();
  const agentExecutionId = `run-${payload.runId ?? "manual"}`;
  const persisted = await db.upsertExecutiveMetricsSnapshot({
    tenantId: payload.tenantId,
    snapshotDate,
    agentExecutionId,
    snapshot: {
      assetHealthIndex: snapshot.assetHealthIndex,
      maintenanceCostProjection: snapshot.maintenanceCostProjection,
      inventoryPressureIndex: snapshot.inventoryPressureIndex,
      vendorRiskIndex: snapshot.vendorRiskIndex,
      supplyChainRiskIndex: snapshot.supplyChainRiskIndex,
      fleetUtilizationRate: snapshot.fleetUtilizationRate,
      technicianProductivityScore: snapshot.technicianProductivityScore,
      overallOperationsIndex: snapshot.overallOperationsIndex,
    },
  });

  return {
    success: true,
    tenantId: payload.tenantId,
    snapshotDate: snapshotDate.toISOString(),
    operationsStatus: snapshot.operationsStatus,
    overallOperationsIndex: snapshot.overallOperationsIndex,
    snapshotsPersisted: persisted.snapshotRows,
    trendsPersisted: persisted.trendRows,
  };
}
