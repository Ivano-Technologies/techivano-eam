export type ProcurementPriority =
  | "monitor"
  | "prepare_procurement"
  | "reorder"
  | "immediate_procurement";

export type ProcurementSignalInput = {
  tenantId: number;
  stockItemId: number;
  candidateVendorId: number;
  demandPressure: number;
  leadTimeRisk: number;
  vendorRisk: number;
  stockoutProbability: number;
  currentStock: number;
  reorderPoint: number;
  unitCost: number;
};

export type ProcurementRecommendationOutput = {
  stockItemId: number;
  recommendedVendorId: number;
  recommendedQuantity: number;
  demandScore: number;
  vendorRiskScore: number;
  procurementScore: number;
  procurementPriority: ProcurementPriority;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, Number(value.toFixed(4))));

export function computeProcurementScore(input: {
  demandPressure: number;
  leadTimeRisk: number;
  vendorRisk: number;
  stockoutProbability: number;
}) {
  return clamp01(
    0.4 * input.demandPressure +
      0.3 * input.leadTimeRisk +
      0.2 * input.vendorRisk +
      0.1 * input.stockoutProbability,
  );
}

export function classifyProcurementPriority(score: number): ProcurementPriority {
  if (score >= 0.8) return "immediate_procurement";
  if (score >= 0.6) return "reorder";
  if (score >= 0.4) return "prepare_procurement";
  return "monitor";
}

export function evaluateProcurementRecommendation(input: ProcurementSignalInput): ProcurementRecommendationOutput {
  const procurementScore = computeProcurementScore({
    demandPressure: input.demandPressure,
    leadTimeRisk: input.leadTimeRisk,
    vendorRisk: input.vendorRisk,
    stockoutProbability: input.stockoutProbability,
  });
  const procurementPriority = classifyProcurementPriority(procurementScore);
  const deficit = Math.max(0, input.reorderPoint - input.currentStock);
  const urgencyFactor = 1 + procurementScore;
  const recommendedQuantity = Math.max(1, Math.ceil(deficit * urgencyFactor));

  return {
    stockItemId: input.stockItemId,
    recommendedVendorId: input.candidateVendorId,
    recommendedQuantity,
    demandScore: clamp01(input.demandPressure),
    vendorRiskScore: clamp01(input.vendorRisk),
    procurementScore,
    procurementPriority,
  };
}

export function generateProcurementRecommendations(inputs: ProcurementSignalInput[]) {
  const byStockItem = new Map<number, ProcurementRecommendationOutput[]>();
  for (const input of inputs) {
    const evaluated = evaluateProcurementRecommendation(input);
    const existing = byStockItem.get(input.stockItemId) ?? [];
    existing.push(evaluated);
    byStockItem.set(input.stockItemId, existing);
  }

  const recommendations: ProcurementRecommendationOutput[] = [];
  for (const options of Array.from(byStockItem.values())) {
    options.sort(
      (a: ProcurementRecommendationOutput, b: ProcurementRecommendationOutput) =>
        b.procurementScore - a.procurementScore,
    );
    recommendations.push(options[0]);
  }
  return recommendations;
}

const procurementService = {
  computeProcurementScore,
  classifyProcurementPriority,
  evaluateProcurementRecommendation,
  generateProcurementRecommendations,
};

export default procurementService;
