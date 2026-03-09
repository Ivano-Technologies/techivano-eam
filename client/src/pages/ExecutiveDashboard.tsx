import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

function statusTone(status: string) {
  if (status === "Critical") return "bg-red-200 text-red-900 border-red-400";
  if (status === "Risk") return "bg-orange-100 text-orange-800 border-orange-300";
  if (status === "Watch") return "bg-yellow-100 text-yellow-800 border-yellow-300";
  if (status === "Stable") return "bg-blue-100 text-blue-800 border-blue-300";
  return "bg-green-100 text-green-800 border-green-300";
}

export default function ExecutiveDashboard() {
  const utils = trpc.useUtils();
  const metricsQuery = trpc.executiveV1.metrics.useQuery();
  const trendsQuery = trpc.executiveV1.kpiTrends.useQuery({ limit: 50 });
  const metrics = metricsQuery.data as Record<string, unknown> | undefined;
  const trends = trendsQuery.data as { id?: number; metricName?: string; metricValue?: number; trendDirection?: string }[] | undefined;
  const computeMutation = trpc.executiveV1.compute.useMutation({
    onSuccess: () => {
      toast.success("Executive metrics computation queued");
      utils.executiveV1.metrics.invalidate();
      utils.executiveV1.kpiTrends.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Executive Intelligence</h1>
          <p className="text-muted-foreground">Unified operational health, trends, and strategic KPIs.</p>
        </div>
        <Button
          disabled={computeMutation.isPending}
          onClick={() => computeMutation.mutate({})}
        >
          {computeMutation.isPending ? "Queuing..." : "Refresh Metrics"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Operations Index</CardTitle>
          <CardDescription>Top-level enterprise health snapshot.</CardDescription>
        </CardHeader>
        <CardContent>
          {metricsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading executive snapshot...</p>
          ) : metrics ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="text-4xl font-bold">{Number(metrics.overallOperationsIndex ?? 0).toFixed(1)}</div>
                <Badge className={statusTone(
                  Number(metrics.overallOperationsIndex ?? 0) >= 90
                    ? "Optimal"
                    : Number(metrics.overallOperationsIndex ?? 0) >= 75
                      ? "Stable"
                      : Number(metrics.overallOperationsIndex ?? 0) >= 60
                        ? "Watch"
                        : Number(metrics.overallOperationsIndex ?? 0) >= 40
                          ? "Risk"
                          : "Critical",
                )}>
                  {Number(metrics.overallOperationsIndex ?? 0) >= 90
                    ? "Optimal"
                    : Number(metrics.overallOperationsIndex ?? 0) >= 75
                      ? "Stable"
                      : Number(metrics.overallOperationsIndex ?? 0) >= 60
                        ? "Watch"
                        : Number(metrics.overallOperationsIndex ?? 0) >= 40
                          ? "Risk"
                          : "Critical"}
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div>Asset health: {Number(metrics.assetHealthIndex ?? 0).toFixed(3)}</div>
                <div>Maintenance projection: {Number(metrics.maintenanceCostProjection ?? 0).toFixed(3)}</div>
                <div>Inventory pressure: {Number(metrics.inventoryPressureIndex ?? 0).toFixed(3)}</div>
                <div>Vendor risk: {Number(metrics.vendorRiskIndex ?? 0).toFixed(3)}</div>
                <div>Supply chain risk: {Number(metrics.supplyChainRiskIndex ?? 0).toFixed(3)}</div>
                <div>Fleet utilization: {Number(metrics.fleetUtilizationRate ?? 0).toFixed(3)}</div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No executive snapshot yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>KPI Trends</CardTitle>
          <CardDescription>Recent trend entries across operational KPIs.</CardDescription>
        </CardHeader>
        <CardContent>
          {trendsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading KPI trends...</p>
          ) : trends && trends.length > 0 ? (
            <div className="space-y-2">
              {trends.map((row) => (
                <div key={row.id ?? 0} className="rounded-md border p-3 flex items-center justify-between">
                  <div className="text-sm">
                    <div className="font-medium">{row.metricName}</div>
                    <div className="text-muted-foreground">Value {Number(row.metricValue ?? 0).toFixed(3)}</div>
                  </div>
                  <Badge>{row.trendDirection ?? ""}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No KPI trends recorded yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
