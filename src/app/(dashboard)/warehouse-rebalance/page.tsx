import { createServerClient } from "@/lib/supabase/server";
import { requireServerUser } from "@/lib/supabase/session";
import { WarehouseRebalanceDashboard } from "@/components/dashboard/WarehouseRebalanceDashboard";

export default async function WarehouseRebalancePage() {
  const supabase = await createServerClient();
  const user = await requireServerUser(supabase);

  const { data } = await supabase
    .from("warehouse_transfer_recommendations")
    .select("*")
    .eq("tenant_id", user.id)
    .order("created_at", { ascending: false })
    .limit(25);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Warehouse Intelligence</h1>
      <WarehouseRebalanceDashboard recommendations={data ?? []} />
    </div>
  );
}
