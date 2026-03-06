import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseForRequest } from "@/lib/supabase/server";
import { withRateLimit } from "@/lib/with-rate-limit";
import { ensureTenantMatch, resolveTenantId } from "@/lib/tenant/context";
import { rebalanceStock } from "@/lib/services/warehouse-intelligence";

const bodySchema = z.object({
  tenant_id: z.string().uuid().optional(),
  business_id: z.string().uuid().optional(),
  signals: z
    .array(
      z.object({
        warehouseId: z.string().min(1),
        productId: z.string().uuid().optional().nullable(),
        availableUnits: z.number().int(),
        targetUnits: z.number().int(),
      }),
    )
    .min(1),
});

async function handleGET(request: NextRequest) {
  const supabase = await getSupabaseForRequest(request);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = request.nextUrl.searchParams.get("tenant_id") ?? user.id;
  if (tenantId !== user.id) {
    return NextResponse.json({ error: "Forbidden tenant context" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("warehouse_transfer_recommendations")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ recommendations: data ?? [] });
}

async function handlePOST(request: NextRequest) {
  const supabase = await getSupabaseForRequest(request);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = bodySchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: payload.error.flatten() },
      { status: 400 },
    );
  }

  try {
    ensureTenantMatch(user.id, payload.data);
  } catch {
    return NextResponse.json({ error: "Forbidden tenant context" }, { status: 403 });
  }
  const tenantId = resolveTenantId(user.id, payload.data);
  const recommendations = await rebalanceStock(
    supabase,
    tenantId,
    payload.data.signals.map((row) => ({
      tenantId,
      warehouseId: row.warehouseId,
      productId: row.productId,
      availableUnits: row.availableUnits,
      targetUnits: row.targetUnits,
    })),
  );
  return NextResponse.json({ recommendations }, { status: 201 });
}

export const GET = withRateLimit(handleGET);
export const POST = withRateLimit(handlePOST, { limit: 40 });
