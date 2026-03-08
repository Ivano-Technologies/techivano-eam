export type SupplyChainRiskBand = "low" | "moderate" | "elevated" | "high" | "critical";

export type SupplyChainRiskInput = {
  tenantId: number;
  stockItemId: number;
  vendorId: number;
  demandVolatility: number;
  leadTimeRisk: number;
  vendorRisk: number;
  transportRisk: number;
  inventoryPressure: number;
};

export type SupplyChainRiskOutput = {
  stockItemId: number;
  vendorId: number;
  demandVolatility: number;
  leadTimeRisk: number;
  vendorRisk: number;
  transportRisk: number;
  inventoryPressure: number;
  riskIndex: number;
  riskBand: SupplyChainRiskBand;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, Number(value.toFixed(4))));

export function computeDemandVolatility(value: number) {
  return clamp01(value);
}

export function computeLeadTimeRisk(value: number) {
  return clamp01(value);
}

export function computeInventoryPressure(value: number) {
  return clamp01(value);
}

export function classifyRiskBand(riskIndex: number): SupplyChainRiskBand {
  if (riskIndex >= 0.9) return "critical";
  if (riskIndex >= 0.7) return "high";
  if (riskIndex >= 0.5) return "elevated";
  if (riskIndex >= 0.3) return "moderate";
  return "low";
}

export function evaluateRisk(input: SupplyChainRiskInput): SupplyChainRiskOutput {
  const demandVolatility = computeDemandVolatility(input.demandVolatility);
  const leadTimeRisk = computeLeadTimeRisk(input.leadTimeRisk);
  const vendorRisk = clamp01(input.vendorRisk);
  const transportRisk = clamp01(input.transportRisk);
  const inventoryPressure = computeInventoryPressure(input.inventoryPressure);

  const riskIndex = clamp01(
    0.3 * demandVolatility +
      0.25 * vendorRisk +
      0.2 * leadTimeRisk +
      0.15 * inventoryPressure +
      0.1 * transportRisk,
  );

  return {
    stockItemId: input.stockItemId,
    vendorId: input.vendorId,
    demandVolatility,
    leadTimeRisk,
    vendorRisk,
    transportRisk,
    inventoryPressure,
    riskIndex,
    riskBand: classifyRiskBand(riskIndex),
  };
}

export function evaluateRiskBatch(inputs: SupplyChainRiskInput[]) {
  return inputs.map(evaluateRisk);
}

const supplyChainRiskService = {
  computeDemandVolatility,
  computeLeadTimeRisk,
  computeInventoryPressure,
  classifyRiskBand,
  evaluateRisk,
  evaluateRiskBatch,
};

export default supplyChainRiskService;
