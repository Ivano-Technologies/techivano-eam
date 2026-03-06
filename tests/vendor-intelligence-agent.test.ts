import { describe, expect, it } from "vitest";
import { scoreVendor } from "@/lib/services/vendor-intelligence-agent";

describe("Sprint 8 vendor intelligence", () => {
  it("scores strong vendors higher and risk lower", () => {
    const score = scoreVendor({
      tenantId: "tenant-1",
      vendorName: "Vendor A",
      deliveries: 100,
      onTimeDeliveries: 95,
      qualityIncidents: 2,
      averageLeadTimeDays: 2,
    });

    expect(score.weighted).toBeGreaterThan(70);
    expect(score.riskScore).toBeLessThan(40);
  });
});
