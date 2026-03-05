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
