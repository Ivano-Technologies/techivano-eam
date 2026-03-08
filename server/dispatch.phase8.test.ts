import { beforeEach, describe, expect, it, vi } from "vitest";
import dispatchOptimizationService from "./modules/dispatch/dispatchOptimizationService";

vi.mock("./db", () => {
  return {
    getDispatchOptimizationInputs: vi.fn(),
    upsertDispatchAssignments: vi.fn(),
  };
});

import * as db from "./db";
import { processJob } from "./jobs/processors";

describe("dispatch phase8 optimization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("computes deterministic dispatch score", () => {
    const score = dispatchOptimizationService.computeDispatchScore({
      travelTime: 0.5,
      technicianSkillMatch: 0.9,
      assetPriority: 0.8,
      workloadBalance: 0.7,
      routeEfficiency: 0.6,
    });
    // 0.35*0.5 + 0.25*(1-0.9) + 0.2*(1-0.8) + 0.1*(1-0.7) + 0.1*(1-0.6) = 0.31
    expect(score).toBeCloseTo(0.31, 3);
  });

  it("selects the lowest score assignment per work order", () => {
    const results = dispatchOptimizationService.evaluateDispatchOptions([
      {
        tenantId: 1,
        workOrderId: 99,
        technicianId: 10,
        fleetUnitId: 20,
        travelTime: 0.2,
        technicianSkillMatch: 1,
        assetPriority: 0.9,
        workloadBalance: 0.8,
        routeEfficiency: 0.9,
        routeDistance: 12,
      },
      {
        tenantId: 1,
        workOrderId: 99,
        technicianId: 11,
        fleetUnitId: 21,
        travelTime: 0.7,
        technicianSkillMatch: 0.3,
        assetPriority: 0.4,
        workloadBalance: 0.4,
        routeEfficiency: 0.5,
        routeDistance: 70,
      },
    ]);

    expect(results).toHaveLength(1);
    expect(results[0].technicianId).toBe(10);
    expect(results[0].fleetUnitId).toBe(20);
  });

  it("executes worker with tenant-scoped input and persistence", async () => {
    vi.mocked(db.getDispatchOptimizationInputs).mockResolvedValue([
      {
        tenantId: 6,
        workOrderId: 101,
        technicianId: 1,
        fleetUnitId: 2,
        travelTime: 0.4,
        technicianSkillMatch: 1,
        assetPriority: 0.8,
        workloadBalance: 0.7,
        routeEfficiency: 0.9,
        routeDistance: 30,
      },
    ]);
    vi.mocked(db.upsertDispatchAssignments).mockResolvedValue(1);

    const result = await processJob("dispatch.optimizeAssignments", {
      tenantId: 6,
      requestedBy: 5,
      runId: 88,
      requestedAt: new Date().toISOString(),
      workOrderId: 101,
      facilityId: 3,
    });

    expect(db.getDispatchOptimizationInputs).toHaveBeenCalledWith({
      tenantId: 6,
      workOrderId: 101,
      facilityId: 3,
    });
    expect(db.upsertDispatchAssignments).toHaveBeenCalledTimes(1);
    expect((result as any).tenantId).toBe(6);
    expect((result as any).assignmentsPersisted).toBe(1);
  });
});
