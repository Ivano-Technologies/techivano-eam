import { NextRequest, NextResponse } from "next/server";
import { getSupabaseForRequest } from "@/lib/supabase/server";
import { withRateLimit } from "@/lib/with-rate-limit";

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

  const [assetRisk, stockRisk, complianceAlerts, maintenanceBacklog] =
    await Promise.all([
      supabase
        .from("telemetry_anomaly_events")
        .select("id", { head: true, count: "exact" })
        .eq("tenant_id", tenantId),
      supabase
        .from("warehouse_transfer_recommendations")
        .select("id", { head: true, count: "exact" })
        .eq("tenant_id", tenantId)
        .eq("status", "pending"),
      supabase
        .from("platform_events")
        .select("id", { head: true, count: "exact" })
        .eq("tenant_id", tenantId)
        .ilike("event_type", "%compliance%"),
      supabase
        .from("platform_events")
        .select("id", { head: true, count: "exact" })
        .eq("tenant_id", tenantId)
        .ilike("event_type", "%maintenance%"),
    ]);

  return NextResponse.json({
    assetRisk: assetRisk.count ?? 0,
    stockRisk: stockRisk.count ?? 0,
    complianceAlerts: complianceAlerts.count ?? 0,
    maintenanceBacklog: maintenanceBacklog.count ?? 0,
  });
}

export const GET = withRateLimit(handleGET, { limit: 120 });
