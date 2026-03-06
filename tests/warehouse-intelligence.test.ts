import { describe, expect, it } from "vitest";
import { computeTransferRecommendations } from "@/lib/services/warehouse-intelligence";

describe("Sprint 7 warehouse intelligence", () => {
  it("creates transfer recommendations from surplus to shortage", () => {
    const recommendations = computeTransferRecommendations([
      {
        tenantId: "tenant-1",
        warehouseId: "w-a",
        productId: "p-1",
        availableUnits: 200,
        targetUnits: 100,
      },
      {
        tenantId: "tenant-1",
        warehouseId: "w-b",
        productId: "p-1",
        availableUnits: 20,
        targetUnits: 60,
      },
    ]);

    expect(recommendations.length).toBe(1);
    expect(recommendations[0].fromWarehouseId).toBe("w-a");
    expect(recommendations[0].toWarehouseId).toBe("w-b");
    expect(recommendations[0].quantity).toBe(40);
  });
});
