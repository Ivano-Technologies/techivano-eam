import { beforeEach, describe, expect, it, vi } from "vitest";
import { computeVendorScore, evaluateVendorIntelligence } from "./modules/vendor/vendorIntelligenceService";

vi.mock("./db", () => {
  return {
    getVendorScoringInputs: vi.fn(),
    upsertVendorIntelligenceSnapshots: vi.fn(),
  };
});

import * as db from "./db";
import { processJob } from "./jobs/processors";

describe("vendor intelligence phase5", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("computes weighted vendor score deterministically", () => {
    const score = computeVendorScore({
      deliveryReliability: 0.8,
      costVariance: 0.7,
      leadTimeStability: 0.9,
      defectRate: 0.6,
    });
    // 0.4*0.8 + 0.25*0.7 + 0.2*0.9 + 0.15*0.6 = 0.765
    expect(score).toBeCloseTo(0.765, 3);
  });

  it("produces risk bands from evaluated vendor intelligence", async () => {
    const output = await evaluateVendorIntelligence([
      {
        tenantId: 2,
        vendorId: 11,
        vendorName: "Vendor A",
        txIn: 120,
        txOut: 60,
        txTotal: 180,
        lowStockRatio: 0.05,
        costDeviation: 0.1,
      },
      {
        tenantId: 2,
        vendorId: 12,
        vendorName: "Vendor B",
        txIn: 4,
        txOut: 3,
        txTotal: 7,
        lowStockRatio: 0.7,
        costDeviation: 0.9,
      },
    ]);

    expect(output.performance.length).toBe(2);
    expect(output.risks.length).toBe(2);
    expect(output.risks[0].riskBand).not.toBeUndefined();
  });

  it("executes vendor risk worker with tenant isolation", async () => {
    vi.mocked(db.getVendorScoringInputs).mockResolvedValue([
      {
        tenantId: 5,
        vendorId: 90,
        vendorName: "Vendor 90",
        txIn: 20,
        txOut: 10,
        txTotal: 30,
        lowStockRatio: 0.2,
        costDeviation: 0.25,
      },
    ]);
    vi.mocked(db.upsertVendorIntelligenceSnapshots).mockResolvedValue({
      performanceRows: 1,
      riskRows: 1,
    });

    const result = await processJob("vendor.computeRiskScores", {
      tenantId: 5,
      requestedBy: 1,
      requestedAt: new Date().toISOString(),
      runId: 77,
    });

    expect(db.getVendorScoringInputs).toHaveBeenCalledWith(5);
    expect(db.upsertVendorIntelligenceSnapshots).toHaveBeenCalledTimes(1);
    expect((result as any).tenantId).toBe(5);
    expect((result as any).riskRowsPersisted).toBe(1);
  });
});
