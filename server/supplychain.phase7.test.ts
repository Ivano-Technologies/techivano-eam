import { beforeEach, describe, expect, it, vi } from "vitest";
import supplyChainRiskService from "./modules/supplychain/supplyChainRiskService";

vi.mock("./db", () => {
  return {
    getSupplyChainRiskInputs: vi.fn(),
    upsertSupplyChainRiskSnapshots: vi.fn(),
  };
});

import * as db from "./db";
import { processJob } from "./jobs/processors";

describe("supply chain risk phase7", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("computes deterministic risk index formula", () => {
    const risk = supplyChainRiskService.evaluateRisk({
      tenantId: 1,
      stockItemId: 5,
      vendorId: 9,
      demandVolatility: 0.7,
      leadTimeRisk: 0.6,
      vendorRisk: 0.5,
      transportRisk: 0.3,
      inventoryPressure: 0.8,
    });
    // 0.3*0.7 + 0.25*0.5 + 0.2*0.6 + 0.15*0.8 + 0.1*0.3 = 0.605
    expect(risk.riskIndex).toBeCloseTo(0.605, 3);
    expect(risk.riskBand).toBe("elevated");
  });

  it("classifies risk bands correctly", () => {
    expect(supplyChainRiskService.classifyRiskBand(0.2)).toBe("low");
    expect(supplyChainRiskService.classifyRiskBand(0.4)).toBe("moderate");
    expect(supplyChainRiskService.classifyRiskBand(0.6)).toBe("elevated");
    expect(supplyChainRiskService.classifyRiskBand(0.8)).toBe("high");
    expect(supplyChainRiskService.classifyRiskBand(0.95)).toBe("critical");
  });

  it("executes worker with tenant-scoped persistence and event counts", async () => {
    vi.mocked(db.getSupplyChainRiskInputs).mockResolvedValue([
      {
        tenantId: 7,
        stockItemId: 11,
        vendorId: 100,
        demandVolatility: 0.9,
        leadTimeRisk: 0.8,
        vendorRisk: 0.7,
        transportRisk: 0.6,
        inventoryPressure: 0.9,
      },
    ]);
    vi.mocked(db.upsertSupplyChainRiskSnapshots).mockResolvedValue({
      scoreRows: 1,
      eventRows: 1,
    });

    const result = await processJob("supplychain.evaluateRisk", {
      tenantId: 7,
      requestedBy: 3,
      runId: 101,
      requestedAt: new Date().toISOString(),
      stockItemId: 11,
    });

    expect(db.getSupplyChainRiskInputs).toHaveBeenCalledWith({
      tenantId: 7,
      stockItemId: 11,
      vendorId: undefined,
    });
    expect(db.upsertSupplyChainRiskSnapshots).toHaveBeenCalledTimes(1);
    expect((result as any).tenantId).toBe(7);
    expect((result as any).riskEventsPersisted).toBe(1);
  });
});
