export interface TelemetryPoint {
  assetId: string;
  signalName: string;
  value: number;
  timestamp: string;
}

export interface AggregatedTelemetry {
  assetId: string;
  signalName: string;
  average: number;
  min: number;
  max: number;
  sampleCount: number;
}

export interface AnomalyResult {
  assetId: string;
  signalName: string;
  signalValue: number;
  baselineValue: number;
  anomalyScore: number;
  severity: "low" | "medium" | "high";
}

export function telemetryAggregate(points: TelemetryPoint[]): AggregatedTelemetry[] {
  const buckets = new Map<string, number[]>();
  for (const point of points) {
    const key = `${point.assetId}::${point.signalName}`;
    const current = buckets.get(key) ?? [];
    current.push(point.value);
    buckets.set(key, current);
  }
  return Array.from(buckets.entries()).map(([key, values]) => {
    const [assetId, signalName] = key.split("::");
    const sum = values.reduce((acc, value) => acc + value, 0);
    const average = values.length > 0 ? sum / values.length : 0;
    return {
      assetId,
      signalName,
      average,
      min: Math.min(...values),
      max: Math.max(...values),
      sampleCount: values.length,
    };
  });
}

export function telemetryDetectAnomalies(
  points: TelemetryPoint[],
  baseline: Record<string, number>,
  thresholdRatio: number = 0.25,
): AnomalyResult[] {
  const results: AnomalyResult[] = [];
  for (const point of points) {
    const baselineKey = `${point.assetId}::${point.signalName}`;
    const base = baseline[baselineKey];
    if (base === undefined) continue;
    const ratio = Math.abs(point.value - base) / Math.max(Math.abs(base), 1e-6);
    if (ratio < thresholdRatio) continue;
    results.push({
      assetId: point.assetId,
      signalName: point.signalName,
      signalValue: point.value,
      baselineValue: base,
      anomalyScore: Number(ratio.toFixed(4)),
      severity: ratio >= 0.75 ? "high" : ratio >= 0.45 ? "medium" : "low",
    });
  }
  return results;
}
