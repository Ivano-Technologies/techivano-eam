import { describe, expect, it } from "vitest";
import {
  telemetryAggregate,
  telemetryDetectAnomalies,
} from "@/lib/telemetry/anomaly-detection";

describe("Sprint 11 telemetry intelligence", () => {
  it("aggregates telemetry points by asset and signal", () => {
    const aggregates = telemetryAggregate([
      { assetId: "asset-1", signalName: "temperature", value: 10, timestamp: "t1" },
      { assetId: "asset-1", signalName: "temperature", value: 20, timestamp: "t2" },
      { assetId: "asset-2", signalName: "vibration", value: 3, timestamp: "t3" },
    ]);

    expect(aggregates.length).toBe(2);
    const temp = aggregates.find((x) => x.assetId === "asset-1");
    expect(temp?.average).toBe(15);
  });

  it("detects anomalies above threshold and respects boundary", () => {
    const baseline = {
      "asset-1::temperature": 100,
    };
    const anomalies = telemetryDetectAnomalies(
      [
        { assetId: "asset-1", signalName: "temperature", value: 130, timestamp: "t1" }, // 30%
        { assetId: "asset-1", signalName: "temperature", value: 115, timestamp: "t2" }, // 15%
      ],
      baseline,
      0.25,
    );

    expect(anomalies.length).toBe(1);
    expect(anomalies[0].signalValue).toBe(130);
  });
});
