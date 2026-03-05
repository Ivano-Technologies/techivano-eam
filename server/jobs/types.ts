export type BackgroundJobName =
  | "pm-evaluation"
  | "predictive.scoreAssets"
  | "reports.generateSnapshot"
  | "telemetry.aggregateHourly";

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

export type BackgroundJobPayload =
  | PmEvaluationJobPayload
  | PredictiveScoringJobPayload
  | ReportGenerationJobPayload
  | TelemetryAggregationJobPayload;
