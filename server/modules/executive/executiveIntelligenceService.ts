export type ExecutiveMetricInputs = {
  assetHealthIndex: number;
  maintenanceCostProjection: number;
  inventoryPressureIndex: number;
  vendorRiskIndex: number;
  supplyChainRiskIndex: number;
  fleetUtilizationRate: number;
  technicianProductivityScore: number;
};

export type OperationsStatus = "Optimal" | "Stable" | "Watch" | "Risk" | "Critical";

const clamp01 = (value: number) => Math.max(0, Math.min(1, Number(value.toFixed(4))));

export function computeMaintenanceCostProjection(value: number) {
  return clamp01(value);
}

export function computeInventoryPressureIndex(value: number) {
  return clamp01(value);
}

export function computeFleetUtilization(value: number) {
  return clamp01(value);
}

export function computeTechnicianProductivity(value: number) {
  return clamp01(value);
}

export function computeOperationsIndex(input: ExecutiveMetricInputs) {
  const normalized =
    0.3 * clamp01(input.assetHealthIndex) +
    0.2 * clamp01(input.maintenanceCostProjection) +
    0.15 * clamp01(input.inventoryPressureIndex) +
    0.15 * clamp01(input.supplyChainRiskIndex) +
    0.1 * clamp01(input.fleetUtilizationRate) +
    0.1 * clamp01(input.technicianProductivityScore);
  return Number((normalized * 100).toFixed(2));
}

export function classifyOperationsStatus(score: number): OperationsStatus {
  if (score >= 90) return "Optimal";
  if (score >= 75) return "Stable";
  if (score >= 60) return "Watch";
  if (score >= 40) return "Risk";
  return "Critical";
}

export function buildExecutiveMetricsSnapshot(input: ExecutiveMetricInputs) {
  const normalized = {
    assetHealthIndex: clamp01(input.assetHealthIndex),
    maintenanceCostProjection: computeMaintenanceCostProjection(input.maintenanceCostProjection),
    inventoryPressureIndex: computeInventoryPressureIndex(input.inventoryPressureIndex),
    vendorRiskIndex: clamp01(input.vendorRiskIndex),
    supplyChainRiskIndex: clamp01(input.supplyChainRiskIndex),
    fleetUtilizationRate: computeFleetUtilization(input.fleetUtilizationRate),
    technicianProductivityScore: computeTechnicianProductivity(input.technicianProductivityScore),
  };
  const overallOperationsIndex = computeOperationsIndex(normalized);
  return {
    ...normalized,
    overallOperationsIndex,
    operationsStatus: classifyOperationsStatus(overallOperationsIndex),
  };
}

const executiveIntelligenceService = {
  computeOperationsIndex,
  computeMaintenanceCostProjection,
  computeInventoryPressureIndex,
  computeFleetUtilization,
  computeTechnicianProductivity,
  classifyOperationsStatus,
  buildExecutiveMetricsSnapshot,
};

export default executiveIntelligenceService;
