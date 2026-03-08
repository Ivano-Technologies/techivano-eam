import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  classifyWarehouse,
  computeWarehousePressure,
  computeTransferPlan,
  generateTransferRecommendations,
  type WarehouseMetricInput,
} from "./modules/warehouse/warehouseIntelligenceService";

vi.mock("./db", () => {
  return {
    getInventoryWarehouseMetrics: vi.fn(),
    upsertWarehouseTransferRecommendations: vi.fn(),
  };
});

import * as db from "./db";
import { processJob } from "./jobs/processors";

describe("warehouse phase4 intelligence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("computes deterministic pressure score", () => {
    const score = computeWarehousePressure(
      {
        tenantId: 2,
        stockItemId: 9,
        warehouseId: 3,
        warehouseName: "Lagos",
        currentStock: 10,
        minStockLevel: 8,
        reorderPoint: 20,
        backlogCount: 8,
        assetDensity: 20,
        recentUsage: 15,
        transferCostFactor: 0.4,
      },
      {
        maxBacklog: 10,
        maxAssetDensity: 40,
        maxUsage: 30,
      },
    ).pressureScore;

    // 0.3*(0.5)+0.25*(0.8)+0.2*(0.5)+0.15*(0.5)+0.1*(0.4)=0.565
    expect(score).toBeCloseTo(0.565, 3);
  });

  it("classifies warehouses by pressure thresholds", () => {
    expect(classifyWarehouse(0.2)).toBe("surplus");
    expect(classifyWarehouse(0.5)).toBe("balanced");
    expect(classifyWarehouse(0.7)).toBe("needs_stock");
    expect(classifyWarehouse(0.9)).toBe("critical_shortage");
  });

  it("matches surplus to shortage for transfer recommendations", async () => {
    const metrics: WarehouseMetricInput[] = [
      {
        tenantId: 1,
        stockItemId: 5,
        warehouseId: 10,
        warehouseName: "Abuja",
        currentStock: 120,
        minStockLevel: 20,
        reorderPoint: 40,
        backlogCount: 1,
        assetDensity: 5,
        recentUsage: 2,
      },
      {
        tenantId: 1,
        stockItemId: 5,
        warehouseId: 11,
        warehouseName: "Kano",
        currentStock: 5,
        minStockLevel: 15,
        reorderPoint: 50,
        backlogCount: 20,
        assetDensity: 30,
        recentUsage: 40,
      },
    ];

    const { pressures } = await computeTransferPlan({ tenantId: 1, stockItemId: 5, metrics });
    const recos = generateTransferRecommendations(pressures);
    expect(recos.length).toBe(1);
    expect(recos[0].sourceWarehouseId).toBe(10);
    expect(recos[0].targetWarehouseId).toBe(11);
    expect(recos[0].transferQuantity).toBeGreaterThan(0);
  });

  it("executes worker job with tenant isolation and persistence", async () => {
    const metrics: WarehouseMetricInput[] = [
      {
        tenantId: 7,
        stockItemId: 17,
        warehouseId: 1,
        warehouseName: "A",
        currentStock: 200,
        minStockLevel: 30,
        reorderPoint: 60,
        backlogCount: 2,
        assetDensity: 4,
        recentUsage: 5,
      },
      {
        tenantId: 7,
        stockItemId: 17,
        warehouseId: 2,
        warehouseName: "B",
        currentStock: 5,
        minStockLevel: 20,
        reorderPoint: 80,
        backlogCount: 25,
        assetDensity: 20,
        recentUsage: 30,
      },
    ];

    vi.mocked(db.getInventoryWarehouseMetrics).mockResolvedValue(metrics);
    vi.mocked(db.upsertWarehouseTransferRecommendations).mockResolvedValue(1);

    const result = await processJob("warehouse.rebalanceStock", {
      tenantId: 7,
      requestedBy: 99,
      runId: 321,
      requestedAt: new Date().toISOString(),
      stockItemId: 17,
    });

    expect(db.getInventoryWarehouseMetrics).toHaveBeenCalledWith(7, 17);
    expect(db.upsertWarehouseTransferRecommendations).toHaveBeenCalledTimes(1);
    expect((result as any).tenantId).toBe(7);
    expect((result as any).recommendationsPersisted).toBe(1);
  });
});
