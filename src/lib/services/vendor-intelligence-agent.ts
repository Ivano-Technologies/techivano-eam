import type { SupabaseClient } from "@supabase/supabase-js";
import { publishEvent } from "@/modules/events/event-bus";

export interface VendorInput {
  tenantId: string;
  vendorId?: string;
  vendorName: string;
  deliveries: number;
  onTimeDeliveries: number;
  qualityIncidents: number;
  averageLeadTimeDays: number;
}

export interface ProcurementRecommendation {
  vendorName: string;
  score: number;
  recommendation: string;
}

export function scoreVendor(input: VendorInput) {
  const onTimeRate =
    input.deliveries > 0 ? (input.onTimeDeliveries / input.deliveries) * 100 : 0;
  const qualityScore = Math.max(
    0,
    100 - (input.qualityIncidents / Math.max(input.deliveries, 1)) * 100,
  );
  const leadTimeScore = Math.max(0, 100 - input.averageLeadTimeDays * 5);
  const weighted =
    onTimeRate * 0.45 + qualityScore * 0.35 + leadTimeScore * 0.2;
  const riskScore = Math.max(0, 100 - weighted);
  return {
    onTimeRate,
    qualityScore,
    leadTimeScore,
    weighted,
    riskScore,
  };
}

export class VendorIntelligenceAgent {
  constructor(private readonly supabase: SupabaseClient) {}

  async evaluate(input: VendorInput): Promise<ProcurementRecommendation> {
    const score = scoreVendor(input);
    const recommendation =
      score.weighted >= 75
        ? "Preferred vendor for procurement routing"
        : score.weighted >= 55
          ? "Use as secondary vendor with monitoring"
          : "Limit allocations and trigger sourcing review";

    const { error } = await this.supabase.from("vendor_performance").insert({
      tenant_id: input.tenantId,
      vendor_id: input.vendorId ?? null,
      vendor_name: input.vendorName,
      on_time_delivery_rate: score.onTimeRate,
      quality_score: score.qualityScore,
      average_lead_time_days: input.averageLeadTimeDays,
      risk_score: score.riskScore,
      recommendation: {
        text: recommendation,
        weighted_score: score.weighted,
      },
    });
    if (error) {
      throw new Error(`Failed to persist vendor performance: ${error.message}`);
    }

    await publishEvent(this.supabase, "vendor.performance.updated", {
      tenantId: input.tenantId,
      vendorName: input.vendorName,
      weightedScore: score.weighted,
    });

    return {
      vendorName: input.vendorName,
      score: Number(score.weighted.toFixed(2)),
      recommendation,
    };
  }
}
