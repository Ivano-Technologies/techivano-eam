import { createServerClient } from "@/lib/supabase/server";
import { requireServerUser } from "@/lib/supabase/session";
import { OperationsCommandCenterDashboard } from "@/components/dashboard/OperationsCommandCenterDashboard";

export default async function CommandCenterPage() {
  const supabase = await createServerClient();
  const user = await requireServerUser(supabase);

  const [anomalies, complianceAlerts, stockRisk] = await Promise.all([
    supabase
      .from("telemetry_anomaly_events")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", user.id),
    supabase
      .from("platform_events")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", user.id)
      .ilike("event_type", "%compliance%"),
    supabase
      .from("warehouse_transfer_recommendations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", user.id)
      .eq("status", "pending"),
  ]);

  const stats = {
    assetRisk: anomalies.count ?? 0,
    stockRisk: stockRisk.count ?? 0,
    complianceAlerts: complianceAlerts.count ?? 0,
    maintenanceBacklog: anomalies.count ?? 0,
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Operations Command Center</h1>
      <OperationsCommandCenterDashboard stats={stats} />
    </div>
  );
}
