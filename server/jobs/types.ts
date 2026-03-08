export type BackgroundJobName =
  | "pm-evaluation"
  | "predictive.scoreAssets"
  | "reports.generateSnapshot"
  | "telemetry.aggregateHourly"
  | "warehouse.rebalanceStock"
  | "vendor.computeRiskScores"
  | "procurement.generateRecommendations"
  | "supplychain.evaluateRisk"
  | "dispatch.optimizeAssignments"
  | "executive.computeMetrics";

export type ReportJobType =
  | "lifecycle-cost"
  | "maintenance-backlog"
  | "downtime-analytics"
  | "asset-utilization";

export interface BaseBackgroundJobPayload {
  tenantId: number;
  requestedBy: number | null;
  runId: number | null;
  requestedAt: string;
}

export interface PmEvaluationJobPayload extends BaseBackgroundJobPayload {
  actorUserId?: number;
}

export interface PredictiveScoringJobPayload extends BaseBackgroundJobPayload {
  assetId?: number;
}

export interface ReportGenerationJobPayload extends BaseBackgroundJobPayload {
  reportType: ReportJobType;
}

export interface TelemetryAggregationJobPayload extends BaseBackgroundJobPayload {
  assetId?: number;
  hour?: string;
}

export interface WarehouseRebalanceJobPayload extends BaseBackgroundJobPayload {
  stockItemId: number;
}

export interface VendorRiskScoringJobPayload extends BaseBackgroundJobPayload {
  vendorId?: number;
}

export interface ProcurementRecommendationJobPayload extends BaseBackgroundJobPayload {
  stockItemId?: number;
}

export interface SupplyChainRiskEvaluationJobPayload extends BaseBackgroundJobPayload {
  stockItemId?: number;
  vendorId?: number;
}

export interface DispatchOptimizationJobPayload extends BaseBackgroundJobPayload {
  workOrderId?: number;
  facilityId?: number;
}

export interface ExecutiveMetricsJobPayload extends BaseBackgroundJobPayload {
  snapshotDate?: string;
}

export type BackgroundJobPayload =
  | PmEvaluationJobPayload
  | PredictiveScoringJobPayload
  | ReportGenerationJobPayload
  | TelemetryAggregationJobPayload
  | WarehouseRebalanceJobPayload
  | VendorRiskScoringJobPayload
  | ProcurementRecommendationJobPayload
  | SupplyChainRiskEvaluationJobPayload
  | DispatchOptimizationJobPayload
  | ExecutiveMetricsJobPayload;
