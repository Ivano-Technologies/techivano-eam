export type DispatchPriority = "routine" | "prioritized" | "urgent" | "critical";

export type DispatchOptionInput = {
  tenantId: number;
  workOrderId: number;
  technicianId: number;
  fleetUnitId: number;
  travelTime: number;
  technicianSkillMatch: number;
  assetPriority: number;
  workloadBalance: number;
  routeEfficiency: number;
  routeDistance: number;
};

export type DispatchAssignmentRecommendation = {
  workOrderId: number;
  technicianId: number;
  fleetUnitId: number;
  dispatchScore: number;
  dispatchPriority: DispatchPriority;
  estimatedTravelTime: number;
  routeDistance: number;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, Number(value.toFixed(4))));

export function computeTravelTime(distanceKm: number) {
  // Normalize with a practical upper cap for city dispatch.
  return clamp01(distanceKm / 120);
}

export function computeSkillMatch(skillProfile: string, requiredSkill: string) {
  if (!requiredSkill) return 0.5;
  return skillProfile.toLowerCase().includes(requiredSkill.toLowerCase()) ? 1 : 0.3;
}

export function computeDispatchScore(input: {
  travelTime: number;
  technicianSkillMatch: number;
  assetPriority: number;
  workloadBalance: number;
  routeEfficiency: number;
}) {
  // Lower score is better. Convert positive signals to "risk-like" values.
  return clamp01(
    0.35 * input.travelTime +
      0.25 * (1 - input.technicianSkillMatch) +
      0.2 * (1 - input.assetPriority) +
      0.1 * (1 - input.workloadBalance) +
      0.1 * (1 - input.routeEfficiency),
  );
}

export function classifyDispatchPriority(score: number): DispatchPriority {
  if (score >= 0.8) return "critical";
  if (score >= 0.6) return "urgent";
  if (score >= 0.4) return "prioritized";
  return "routine";
}

export function evaluateDispatchOptions(options: DispatchOptionInput[]): DispatchAssignmentRecommendation[] {
  const byWorkOrder = new Map<number, DispatchAssignmentRecommendation[]>();
  for (const option of options) {
    const dispatchScore = computeDispatchScore({
      travelTime: option.travelTime,
      technicianSkillMatch: option.technicianSkillMatch,
      assetPriority: option.assetPriority,
      workloadBalance: option.workloadBalance,
      routeEfficiency: option.routeEfficiency,
    });
    const recommendation: DispatchAssignmentRecommendation = {
      workOrderId: option.workOrderId,
      technicianId: option.technicianId,
      fleetUnitId: option.fleetUnitId,
      dispatchScore,
      dispatchPriority: classifyDispatchPriority(dispatchScore),
      estimatedTravelTime: Number((option.travelTime * 120).toFixed(2)),
      routeDistance: Number(option.routeDistance.toFixed(2)),
    };
    const existing = byWorkOrder.get(option.workOrderId) ?? [];
    existing.push(recommendation);
    byWorkOrder.set(option.workOrderId, existing);
  }

  const selected: DispatchAssignmentRecommendation[] = [];
  for (const candidates of Array.from(byWorkOrder.values())) {
    candidates.sort((a, b) => a.dispatchScore - b.dispatchScore);
    selected.push(candidates[0]);
  }
  return selected;
}

const dispatchOptimizationService = {
  evaluateDispatchOptions,
  computeTravelTime,
  computeSkillMatch,
  computeDispatchScore,
  classifyDispatchPriority,
};

export default dispatchOptimizationService;
