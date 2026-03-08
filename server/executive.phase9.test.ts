import { beforeEach, describe, expect, it, vi } from "vitest";
import executiveIntelligenceService from "./modules/executive/executiveIntelligenceService";

vi.mock("./db", () => {
  return {
    getExecutiveMetricsInputs: vi.fn(),
    upsertExecutiveMetricsSnapshot: vi.fn(),
  };
});

import * as db from "./db";
import { processJob } from "./jobs/processors";

describe("executive phase9 intelligence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("computes operations index formula correctly", () => {
    const score = executiveIntelligenceService.computeOperationsIndex({
      assetHealthIndex: 0.9,
      maintenanceCostProjection: 0.8,
      inventoryPressureIndex: 0.7,
      vendorRiskIndex: 0.6,
      supplyChainRiskIndex: 0.5,
      fleetUtilizationRate: 0.8,
      technicianProductivityScore: 0.9,
    });
    // weighted sum = 0.78 => 78.00
    expect(score).toBeCloseTo(78, 1);
    expect(executiveIntelligenceService.classifyOperationsStatus(score)).toBe("Stable");
  });

  it("builds executive snapshot payload", () => {
    const snapshot = executiveIntelligenceService.buildExecutiveMetricsSnapshot({
      assetHealthIndex: 0.7,
      maintenanceCostProjection: 0.6,
      inventoryPressureIndex: 0.5,
      vendorRiskIndex: 0.4,
      supplyChainRiskIndex: 0.3,
      fleetUtilizationRate: 0.8,
      technicianProductivityScore: 0.9,
    });
    expect(snapshot.overallOperationsIndex).toBeGreaterThan(0);
    expect(snapshot.operationsStatus).toBeDefined();
  });

  it("executes worker with tenant-scoped persistence", async () => {
    vi.mocked(db.getExecutiveMetricsInputs).mockResolvedValue({
      assetHealthIndex: 0.7,
      maintenanceCostProjection: 0.6,
      inventoryPressureIndex: 0.5,
      vendorRiskIndex: 0.4,
      supplyChainRiskIndex: 0.3,
      fleetUtilizationRate: 0.8,
      technicianProductivityScore: 0.9,
    });
    vi.mocked(db.upsertExecutiveMetricsSnapshot).mockResolvedValue({
      snapshotRows: 1,
      trendRows: 8,
    });

    const result = await processJob("executive.computeMetrics", {
      tenantId: 12,
      requestedBy: 2,
      runId: 909,
      requestedAt: new Date().toISOString(),
      snapshotDate: new Date().toISOString(),
    });

    expect(db.getExecutiveMetricsInputs).toHaveBeenCalledWith(12);
    expect(db.upsertExecutiveMetricsSnapshot).toHaveBeenCalledTimes(1);
    expect((result as any).tenantId).toBe(12);
    expect((result as any).snapshotsPersisted).toBe(1);
  });
});
