import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

function priorityTone(priority: string) {
  if (priority === "immediate_procurement") return "bg-red-100 text-red-800 border-red-300";
  if (priority === "reorder") return "bg-orange-100 text-orange-800 border-orange-300";
  if (priority === "prepare_procurement") return "bg-yellow-100 text-yellow-800 border-yellow-300";
  return "bg-green-100 text-green-800 border-green-300";
}

export default function ProcurementDashboard() {
  const [stockItemIdInput, setStockItemIdInput] = useState("");
  const parsedStockItemId = Number(stockItemIdInput);
  const validStockItemId = Number.isInteger(parsedStockItemId) && parsedStockItemId > 0 ? parsedStockItemId : undefined;

  const utils = trpc.useUtils();
  const recommendationsQuery = trpc.procurementV1.recommendations.useQuery({ limit: 50 });
  type RecRow = { id?: number; stockItemId?: number; recommendedVendorId?: number; recommendedQuantity?: number; procurementPriority?: string };
  const recommendations: RecRow[] = Array.isArray(recommendationsQuery.data) ? (recommendationsQuery.data as RecRow[]) : [];
  const recommendMutation = trpc.procurementV1.recommend.useMutation({
    onSuccess: () => {
      toast.success("Procurement recommendations job queued");
      utils.procurementV1.recommendations.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  const createPoMutation = trpc.procurementV1.createPurchaseOrder.useMutation({
    onSuccess: () => {
      toast.success("Purchase order created");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Procurement Automation</h1>
        <p className="text-muted-foreground">Demand-driven vendor recommendations with urgency bands.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate Recommendations</CardTitle>
          <CardDescription>Run `procurement.generateRecommendations` for all stock items or one item.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="stockItemId">Stock Item ID (optional)</Label>
            <Input
              id="stockItemId"
              type="number"
              min={1}
              placeholder="Leave blank for all"
              value={stockItemIdInput}
              onChange={(event) => setStockItemIdInput(event.target.value)}
              className="w-64"
            />
          </div>
          <Button
            disabled={recommendMutation.isPending}
            onClick={() => recommendMutation.mutate({ stockItemId: validStockItemId })}
          >
            {recommendMutation.isPending ? "Queuing..." : "Generate"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recommendations</CardTitle>
          <CardDescription>Tenant-scoped procurement outputs.</CardDescription>
        </CardHeader>
        <CardContent>
          {recommendationsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading recommendations...</p>
          ) : recommendations.length > 0 ? (
            <div className="space-y-3">
              {recommendations.map((row) => (
                <div key={row.id ?? 0} className="rounded-md border p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm">
                      <span className="font-medium">Stock item:</span> #{row.stockItemId}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Vendor #{row.recommendedVendorId} | quantity {row.recommendedQuantity}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={priorityTone(row.procurementPriority ?? "")}>{row.procurementPriority ?? ""}</Badge>
                    <Button
                      size="sm"
                      disabled={createPoMutation.isPending}
                      onClick={() => { if (row.id != null) createPoMutation.mutate({ recommendationId: row.id }); }}
                    >
                      Create PO
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No procurement recommendations yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
