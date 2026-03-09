import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function badgeVariant(priority: string): "default" | "secondary" | "destructive" | "outline" {
  if (priority === "critical") return "destructive";
  if (priority === "urgent") return "default";
  if (priority === "moderate") return "secondary";
  return "outline";
}

function priorityTone(priority: string): string {
  if (priority === "critical") return "bg-red-100 text-red-800 border-red-300";
  if (priority === "urgent") return "bg-orange-100 text-orange-800 border-orange-300";
  if (priority === "moderate") return "bg-yellow-100 text-yellow-800 border-yellow-300";
  return "bg-green-100 text-green-800 border-green-300";
}

export default function WarehouseRebalanceDashboard() {
  const [stockItemId, setStockItemId] = useState("");
  const parsedStockItemId = useMemo(() => {
    const value = Number(stockItemId);
    return Number.isInteger(value) && value > 0 ? value : undefined;
  }, [stockItemId]);

  const utils = trpc.useUtils();
  const recommendationsQuery = trpc.warehouseV1.recommendations.useQuery({
    stockItemId: parsedStockItemId,
    limit: 50,
  });
  type RecRow = { id?: number; sourceWarehouseId?: number; targetWarehouseId?: number; stockItemId?: number; transferQuantity?: number; transferPriority?: string };
  const recommendations: RecRow[] = Array.isArray(recommendationsQuery.data) ? (recommendationsQuery.data as RecRow[]) : [];

  const rebalanceMutation = trpc.warehouseV1.rebalance.useMutation({
    onSuccess: () => {
      toast.success("Warehouse rebalance job queued");
      utils.warehouseV1.recommendations.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Warehouse Rebalance</h1>
        <p className="text-muted-foreground">Autonomous transfer recommendations by pressure score.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trigger Rebalance</CardTitle>
          <CardDescription>Queue a deterministic worker run for one stock item.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="stockItemId">Stock Item ID</Label>
            <Input
              id="stockItemId"
              type="number"
              min={1}
              placeholder="e.g. 14"
              value={stockItemId}
              onChange={(event) => setStockItemId(event.target.value)}
              className="w-60"
            />
          </div>
          <Button
            disabled={!parsedStockItemId || rebalanceMutation.isPending}
            onClick={() => {
              if (!parsedStockItemId) return;
              rebalanceMutation.mutate({ stockItemId: parsedStockItemId });
            }}
          >
            {rebalanceMutation.isPending ? "Queuing..." : "Run warehouse.rebalanceStock"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transfer Recommendations</CardTitle>
          <CardDescription>Source/target pairs sorted by latest execution time.</CardDescription>
        </CardHeader>
        <CardContent>
          {recommendationsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading recommendations...</p>
          ) : recommendations.length > 0 ? (
            <div className="space-y-3">
              {recommendations.map((row, idx) => (
                <div
                  key={row.id ?? idx}
                  className="rounded-md border p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <p className="text-sm">
                      <span className="font-medium">Source warehouse:</span> #{row.sourceWarehouseId}{" "}
                      <span className="text-muted-foreground">{"->"}</span>{" "}
                      <span className="font-medium">Target warehouse:</span> #{row.targetWarehouseId}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Stock item #{row.stockItemId} | transfer {row.transferQuantity} units
                    </p>
                  </div>
                  <Badge variant={badgeVariant(row.transferPriority ?? "")} className={priorityTone(row.transferPriority ?? "")}>
                    {row.transferPriority ?? ""}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No recommendations available yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
