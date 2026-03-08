import { beforeEach, describe, expect, it, vi } from "vitest";
import procurementService from "./modules/procurement/procurementService";

vi.mock("./db", () => {
  return {
    getProcurementInputSignals: vi.fn(),
    upsertProcurementRecommendations: vi.fn(),
  };
});

import * as db from "./db";
import { processJob } from "./jobs/processors";

describe("procurement phase6 automation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("computes deterministic procurement score", () => {
    const score = procurementService.computeProcurementScore({
      demandPressure: 0.8,
      leadTimeRisk: 0.5,
      vendorRisk: 0.4,
      stockoutProbability: 0.7,
    });
    // 0.4*0.8 + 0.3*0.5 + 0.2*0.4 + 0.1*0.7 = 0.62
    expect(score).toBeCloseTo(0.62, 3);
  });

  it("selects highest scoring vendor recommendation for each stock item", () => {
    const recommendations = procurementService.generateProcurementRecommendations([
      {
        tenantId: 1,
        stockItemId: 50,
        candidateVendorId: 10,
        demandPressure: 0.9,
        leadTimeRisk: 0.8,
        vendorRisk: 0.7,
        stockoutProbability: 0.9,
        currentStock: 2,
        reorderPoint: 30,
        unitCost: 1000,
      },
      {
        tenantId: 1,
        stockItemId: 50,
        candidateVendorId: 11,
        demandPressure: 0.3,
        leadTimeRisk: 0.3,
        vendorRisk: 0.2,
        stockoutProbability: 0.4,
        currentStock: 2,
        reorderPoint: 30,
        unitCost: 900,
      },
    ]);

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].recommendedVendorId).toBe(10);
    expect(recommendations[0].procurementPriority).toBe("immediate_procurement");
  });

  it("executes worker with tenant-scoped persistence", async () => {
    vi.mocked(db.getProcurementInputSignals).mockResolvedValue([
      {
        tenantId: 9,
        stockItemId: 7,
        candidateVendorId: 101,
        demandPressure: 0.8,
        leadTimeRisk: 0.7,
        vendorRisk: 0.6,
        stockoutProbability: 0.9,
        currentStock: 3,
        reorderPoint: 20,
        unitCost: 500,
      },
    ]);
    vi.mocked(db.upsertProcurementRecommendations).mockResolvedValue(1);

    const result = await processJob("procurement.generateRecommendations", {
      tenantId: 9,
      requestedBy: 5,
      runId: 44,
      requestedAt: new Date().toISOString(),
      stockItemId: 7,
    });

    expect(db.getProcurementInputSignals).toHaveBeenCalledWith({
      tenantId: 9,
      stockItemId: 7,
    });
    expect(db.upsertProcurementRecommendations).toHaveBeenCalledTimes(1);
    expect((result as any).tenantId).toBe(9);
    expect((result as any).recommendationsPersisted).toBe(1);
  });
});
