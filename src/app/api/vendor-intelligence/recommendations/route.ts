import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseForRequest } from "@/lib/supabase/server";
import { withRateLimit } from "@/lib/with-rate-limit";
import { ensureTenantMatch, resolveTenantId } from "@/lib/tenant/context";
import { VendorIntelligenceAgent } from "@/lib/services/vendor-intelligence-agent";

const bodySchema = z.object({
  tenant_id: z.string().uuid().optional(),
  business_id: z.string().uuid().optional(),
  vendorName: z.string().min(1),
  vendorId: z.string().uuid().optional(),
  deliveries: z.number().int().min(0).default(0),
  onTimeDeliveries: z.number().int().min(0).default(0),
  qualityIncidents: z.number().int().min(0).default(0),
  averageLeadTimeDays: z.number().min(0).default(0),
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
    .from("vendor_performance")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("evaluated_at", { ascending: false })
    .limit(30);

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

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    ensureTenantMatch(user.id, parsed.data);
  } catch {
    return NextResponse.json({ error: "Forbidden tenant context" }, { status: 403 });
  }
  const tenantId = resolveTenantId(user.id, parsed.data);
  const agent = new VendorIntelligenceAgent(supabase);
  const recommendation = await agent.evaluate({
    tenantId,
    vendorId: parsed.data.vendorId,
    vendorName: parsed.data.vendorName,
    deliveries: parsed.data.deliveries,
    onTimeDeliveries: parsed.data.onTimeDeliveries,
    qualityIncidents: parsed.data.qualityIncidents,
    averageLeadTimeDays: parsed.data.averageLeadTimeDays,
  });
  return NextResponse.json({ recommendation }, { status: 201 });
}

export const GET = withRateLimit(handleGET, { limit: 120 });
export const POST = withRateLimit(handlePOST, { limit: 60 });
