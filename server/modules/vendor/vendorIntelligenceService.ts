type VendorSignalInput = {
  tenantId: number;
  vendorId: number;
  vendorName: string;
  txIn: number;
  txOut: number;
  txTotal: number;
  lowStockRatio: number;
  costDeviation: number;
};

type VendorPerformance = {
  vendorId: number;
  vendorName: string;
  deliveryReliability: number;
  costVariance: number;
  leadTimeStability: number;
  defectRate: number;
  vendorScore: number;
};

type VendorRisk = {
  vendorId: number;
  vendorName: string;
  vendorScore: number;
  riskScore: number;
  riskBand: "low" | "medium" | "high";
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, Number(value.toFixed(4))));

export function computeVendorScore(perf: {
  deliveryReliability: number;
  costVariance: number;
  leadTimeStability: number;
  defectRate: number;
}) {
  return clamp01(
    0.4 * perf.deliveryReliability +
      0.25 * perf.costVariance +
      0.2 * perf.leadTimeStability +
      0.15 * perf.defectRate,
  );
}

function classifyRisk(score: number): VendorRisk["riskBand"] {
  if (score >= 0.66) return "high";
  if (score >= 0.33) return "medium";
  return "low";
}

export async function getRuVectorVendorAdjustment(_tenantId: number, _vendorId: number) {
  // Placeholder deterministic fallback while RuVector similarity endpoint is integrated.
  return 1;
}

export async function evaluateVendorIntelligence(signals: VendorSignalInput[]) {
  const performance: VendorPerformance[] = [];
  const risks: VendorRisk[] = [];

  for (const signal of signals) {
    const adjustment = await getRuVectorVendorAdjustment(signal.tenantId, signal.vendorId);
    const deliveryReliability = clamp01(0.5 + Math.min(0.45, signal.txIn / 120) - Math.min(0.3, signal.lowStockRatio));
    const costVariance = clamp01(1 - Math.min(1, signal.costDeviation));
    const leadTimeStability = clamp01(0.45 + Math.min(0.4, signal.txTotal / 200));
    const defectRate = clamp01(1 - Math.min(1, signal.lowStockRatio * 0.7));
    const vendorScore = clamp01(
      computeVendorScore({
        deliveryReliability,
        costVariance,
        leadTimeStability,
        defectRate,
      }) * adjustment,
    );

    const riskScore = clamp01(1 - vendorScore);
    performance.push({
      vendorId: signal.vendorId,
      vendorName: signal.vendorName,
      deliveryReliability,
      costVariance,
      leadTimeStability,
      defectRate,
      vendorScore,
    });
    risks.push({
      vendorId: signal.vendorId,
      vendorName: signal.vendorName,
      vendorScore,
      riskScore,
      riskBand: classifyRisk(riskScore),
    });
  }

  return {
    performance,
    risks,
  };
}

const vendorIntelligenceService = {
  computeVendorScore,
  evaluateVendorIntelligence,
  getRuVectorVendorAdjustment,
};

export default vendorIntelligenceService;
