import type { SupabaseClient } from "@supabase/supabase-js";
import { publishEvent } from "@/modules/events/event-bus";

export interface WarehouseSignal {
  tenantId: string;
  warehouseId: string;
  productId?: string | null;
  availableUnits: number;
  targetUnits: number;
}

export interface TransferRecommendation {
  fromWarehouseId: string;
  toWarehouseId: string;
  productId?: string | null;
  quantity: number;
  confidence: number;
  reason: string;
}

export function computeTransferRecommendations(
  rows: WarehouseSignal[],
): TransferRecommendation[] {
  const shortage = rows
    .filter((row) => row.availableUnits < row.targetUnits)
    .sort((a, b) => a.availableUnits - a.targetUnits - (b.availableUnits - b.targetUnits));
  const surplus = rows
    .filter((row) => row.availableUnits > row.targetUnits)
    .sort((a, b) => b.availableUnits - b.targetUnits - (a.availableUnits - a.targetUnits));

  const recos: TransferRecommendation[] = [];
  for (const need of shortage) {
    const neededUnits = need.targetUnits - need.availableUnits;
    const donor = surplus.find((s) => s.availableUnits - s.targetUnits > 0);
    if (!donor) continue;
    const movable = donor.availableUnits - donor.targetUnits;
    const quantity = Math.min(neededUnits, movable);
    if (quantity <= 0) continue;
    donor.availableUnits -= quantity;
    recos.push({
      fromWarehouseId: donor.warehouseId,
      toWarehouseId: need.warehouseId,
      productId: need.productId,
      quantity,
      confidence: 0.8,
      reason: "Rebalance projected shortage from available surplus",
    });
  }

  return recos;
}

export async function rebalanceStock(
  supabase: SupabaseClient,
  tenantId: string,
  rows: WarehouseSignal[],
): Promise<TransferRecommendation[]> {
  const recommendations = computeTransferRecommendations(rows);
  if (recommendations.length === 0) return [];

  const { error } = await supabase.from("warehouse_transfer_recommendations").insert(
    recommendations.map((row) => ({
      tenant_id: tenantId,
      from_warehouse_id: row.fromWarehouseId,
      to_warehouse_id: row.toWarehouseId,
      product_id: row.productId ?? null,
      quantity: row.quantity,
      confidence: row.confidence,
      reason: row.reason,
      status: "pending",
    })),
  );

  if (error) {
    throw new Error(`Failed to persist warehouse recommendations: ${error.message}`);
  }

  await publishEvent(supabase, "warehouse.transfer.recommendations.generated", {
    tenantId,
    count: recommendations.length,
  });

  return recommendations;
}

export class WarehouseRebalancingAgent {
  constructor(private readonly supabase: SupabaseClient) {}

  async run(tenantId: string, rows: WarehouseSignal[]) {
    return rebalanceStock(this.supabase, tenantId, rows);
  }
}

export class StockSubstitutionAgent {
  suggestAlternatives(
    options: Array<{ sku: string; availableUnits: number }>,
    requiredUnits: number,
  ): { sku: string; score: number }[] {
    return options
      .filter((item) => item.availableUnits >= requiredUnits)
      .map((item) => ({
        sku: item.sku,
        score: Math.min(1, item.availableUnits / Math.max(requiredUnits, 1)),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }
}
