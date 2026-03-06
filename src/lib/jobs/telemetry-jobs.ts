import { z } from "zod";

export const telemetryAggregatePayloadSchema = z.object({
  tenantId: z.string().uuid(),
  points: z.array(
    z.object({
      assetId: z.string().min(1),
      signalName: z.string().min(1),
      value: z.number(),
      timestamp: z.string(),
    }),
  ),
});

export const telemetryDetectAnomaliesPayloadSchema = z.object({
  tenantId: z.string().uuid(),
  baseline: z.record(z.string(), z.number()),
  points: z.array(
    z.object({
      assetId: z.string().min(1),
      signalName: z.string().min(1),
      value: z.number(),
      timestamp: z.string(),
    }),
  ),
  thresholdRatio: z.number().min(0.01).max(2).default(0.25),
});

export type TelemetryAggregatePayload = z.infer<typeof telemetryAggregatePayloadSchema>;
export type TelemetryDetectAnomaliesPayload = z.infer<
  typeof telemetryDetectAnomaliesPayloadSchema
>;
