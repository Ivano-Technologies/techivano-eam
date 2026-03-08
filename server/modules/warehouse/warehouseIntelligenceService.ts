export type WarehouseMetricInput = {
  tenantId: number;
  stockItemId: number;
  warehouseId: number;
  warehouseName: string;
  currentStock: number;
  minStockLevel: number;
  reorderPoint: number;
  backlogCount: number;
  assetDensity: number;
  recentUsage: number;
  transferDistanceKm?: number;
  transferCostFactor?: number;
};

export type WarehouseClass =
  | "surplus"
  | "balanced"
  | "needs_stock"
  | "critical_shortage";

export type WarehousePressure = {
  warehouseId: number;
  warehouseName: string;
  stockItemId: number;
  pressureScore: number;
  stockDeficitRatio: number;
  backlogPressure: number;
  assetDensityFactor: number;
  demandMomentum: number;
  transferCostFactor: number;
  classification: WarehouseClass;
  availableSurplus: number;
  neededStock: number;
};

export type TransferRecommendation = {
  stockItemId: number;
  sourceWarehouseId: number;
  sourceWarehouseName: string;
  targetWarehouseId: number;
  targetWarehouseName: string;
  transferQuantity: number;
  transferPriority: "balanced" | "moderate" | "urgent" | "critical";
  pressureScore: number;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, Number(value.toFixed(4))));

export function classifyWarehouse(score: number): WarehouseClass {
  if (score >= 0.8) return "critical_shortage";
  if (score >= 0.6) return "needs_stock";
  if (score >= 0.4) return "balanced";
  return "surplus";
}

function priorityFromScore(score: number): TransferRecommendation["transferPriority"] {
  if (score >= 0.8) return "critical";
  if (score >= 0.6) return "urgent";
  if (score >= 0.4) return "moderate";
  return "balanced";
}

export function computeWarehousePressure(
  metric: WarehouseMetricInput,
  normalization: {
    maxBacklog: number;
    maxAssetDensity: number;
    maxUsage: number;
  },
): WarehousePressure {
  const deficit = Math.max(0, metric.reorderPoint - metric.currentStock);
  const stockDeficitRatio = metric.reorderPoint > 0 ? clamp01(deficit / metric.reorderPoint) : 0;
  const backlogPressure = normalization.maxBacklog > 0 ? clamp01(metric.backlogCount / normalization.maxBacklog) : 0;
  const assetDensityFactor =
    normalization.maxAssetDensity > 0 ? clamp01(metric.assetDensity / normalization.maxAssetDensity) : 0;
  const demandMomentum = normalization.maxUsage > 0 ? clamp01(metric.recentUsage / normalization.maxUsage) : 0;
  const transferCostFactor = clamp01(metric.transferCostFactor ?? 0.5);

  const score = clamp01(
    0.3 * stockDeficitRatio +
      0.25 * backlogPressure +
      0.2 * assetDensityFactor +
      0.15 * demandMomentum +
      0.1 * transferCostFactor,
  );

  const classification = classifyWarehouse(score);
  const availableSurplus = Math.max(0, metric.currentStock - Math.max(metric.reorderPoint, metric.minStockLevel));
  const neededStock = Math.max(0, metric.reorderPoint - metric.currentStock);

  return {
    warehouseId: metric.warehouseId,
    warehouseName: metric.warehouseName,
    stockItemId: metric.stockItemId,
    pressureScore: score,
    stockDeficitRatio,
    backlogPressure,
    assetDensityFactor,
    demandMomentum,
    transferCostFactor,
    classification,
    availableSurplus,
    neededStock,
  };
}

export function generateTransferRecommendations(pressures: WarehousePressure[]): TransferRecommendation[] {
  const shortages = pressures
    .filter((item) => item.classification === "critical_shortage" || item.classification === "needs_stock")
    .sort((a, b) => b.pressureScore - a.pressureScore);
  const surpluses = pressures
    .filter((item) => item.classification === "surplus" && item.availableSurplus > 0)
    .sort((a, b) => b.availableSurplus - a.availableSurplus);

  const recommendations: TransferRecommendation[] = [];

  for (const shortage of shortages) {
    let remainingNeed = shortage.neededStock;
    if (remainingNeed <= 0) continue;

    for (const surplus of surpluses) {
      if (remainingNeed <= 0) break;
      if (surplus.availableSurplus <= 0) continue;
      if (surplus.warehouseId === shortage.warehouseId) continue;

      const transferQuantity = Math.min(remainingNeed, surplus.availableSurplus);
      if (transferQuantity <= 0) continue;

      recommendations.push({
        stockItemId: shortage.stockItemId,
        sourceWarehouseId: surplus.warehouseId,
        sourceWarehouseName: surplus.warehouseName,
        targetWarehouseId: shortage.warehouseId,
        targetWarehouseName: shortage.warehouseName,
        transferQuantity,
        transferPriority: priorityFromScore(shortage.pressureScore),
        pressureScore: shortage.pressureScore,
      });

      remainingNeed -= transferQuantity;
      surplus.availableSurplus -= transferQuantity;
    }
  }

  return recommendations;
}

export async function getRuVectorPatternAdjustment(_tenantId: number, _stockItemId: number): Promise<number> {
  // Placeholder deterministic baseline until RuVector similarity endpoint is wired.
  return 1;
}

export async function computeTransferPlan(input: {
  tenantId: number;
  stockItemId: number;
  metrics: WarehouseMetricInput[];
}) {
  const maxBacklog = Math.max(0, ...input.metrics.map((m) => m.backlogCount));
  const maxAssetDensity = Math.max(0, ...input.metrics.map((m) => m.assetDensity));
  const maxUsage = Math.max(0, ...input.metrics.map((m) => m.recentUsage));

  const adjustment = await getRuVectorPatternAdjustment(input.tenantId, input.stockItemId);
  const pressures = input.metrics.map((metric) => {
    const base = computeWarehousePressure(metric, { maxBacklog, maxAssetDensity, maxUsage });
    return {
      ...base,
      pressureScore: clamp01(base.pressureScore * adjustment),
      classification: classifyWarehouse(clamp01(base.pressureScore * adjustment)),
    };
  });

  const recommendations = generateTransferRecommendations(pressures);
  return { adjustment, pressures, recommendations };
}

const warehouseIntelligenceService = {
  classifyWarehouse,
  computeWarehousePressure,
  generateTransferRecommendations,
  getRuVectorPatternAdjustment,
  computeTransferPlan,
};

export default warehouseIntelligenceService;
