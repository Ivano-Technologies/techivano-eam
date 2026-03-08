export type BackgroundJobName =
  | "pm-evaluation"
  | "predictive.scoreAssets"
  | "reports.generateSnapshot"
  | "telemetry.aggregateHourly"
  | "inspection.schedule"
  | "inspection.evaluate"
  | "compliance.evaluate"
  | "sla.calculate"
  | "report.generateAnalytics"
  | "stock.predictDemand"
  | "stock.recommendSubstitution"
  | "stock.allocateInventory"
  | "stock.detectAnomalies"
  | "warehouse.optimizeLayout"
  | "warehouse.rebalanceStock"
  | "vendor.evaluatePerformance";

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

export interface InspectionScheduleJobPayload extends BaseBackgroundJobPayload {
  assetId: number;
  templateId: number;
}

export interface InspectionEvaluateJobPayload extends BaseBackgroundJobPayload {
  assetId: number;
}

export interface ComplianceEvaluateJobPayload extends BaseBackgroundJobPayload {
  assetId: number;
}

export interface SlaCalculationJobPayload extends BaseBackgroundJobPayload {
  assetId: number;
}

export interface ReportAnalyticsJobPayload extends BaseBackgroundJobPayload {
  reportType: string;
}

export interface StockPredictDemandJobPayload extends BaseBackgroundJobPayload {
  stockItemId: number;
  horizonDays?: number;
}

export interface StockRecommendSubstitutionJobPayload extends BaseBackgroundJobPayload {
  itemId: number;
  assetId?: number;
}

export interface StockAllocateInventoryJobPayload extends BaseBackgroundJobPayload {
  workOrderId: number;
  assetId?: number;
}

export interface StockDetectAnomaliesJobPayload extends BaseBackgroundJobPayload {
  warehouseId?: number;
}

export interface WarehouseOptimizeLayoutJobPayload extends BaseBackgroundJobPayload {
  warehouseId: number;
}

export interface WarehouseRebalanceStockJobPayload extends BaseBackgroundJobPayload {
  warehouseId?: number;
  stockItemId?: number;
  lookbackMinutes?: number;
  limit?: number;
}

export interface VendorEvaluatePerformanceJobPayload extends BaseBackgroundJobPayload {
  vendorId?: number;
}

export type BackgroundJobPayload =
  | PmEvaluationJobPayload
  | PredictiveScoringJobPayload
  | ReportGenerationJobPayload
  | TelemetryAggregationJobPayload
  | InspectionScheduleJobPayload
  | InspectionEvaluateJobPayload
  | ComplianceEvaluateJobPayload
  | SlaCalculationJobPayload
  | ReportAnalyticsJobPayload
  | StockPredictDemandJobPayload
  | StockRecommendSubstitutionJobPayload
  | StockAllocateInventoryJobPayload
  | StockDetectAnomaliesJobPayload
  | WarehouseOptimizeLayoutJobPayload
  | WarehouseRebalanceStockJobPayload
  | VendorEvaluatePerformanceJobPayload;
