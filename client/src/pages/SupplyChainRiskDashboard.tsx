import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

function riskTone(band: string) {
  if (band === "critical") return "bg-red-200 text-red-900 border-red-400";
  if (band === "high") return "bg-red-100 text-red-800 border-red-300";
  if (band === "elevated") return "bg-orange-100 text-orange-800 border-orange-300";
  if (band === "moderate") return "bg-yellow-100 text-yellow-800 border-yellow-300";
  return "bg-green-100 text-green-800 border-green-300";
}

export default function SupplyChainRiskDashboard() {
  const [stockItemIdInput, setStockItemIdInput] = useState("");
  const [vendorIdInput, setVendorIdInput] = useState("");
  const parsedStockItemId = Number(stockItemIdInput);
  const parsedVendorId = Number(vendorIdInput);
  const stockItemId = Number.isInteger(parsedStockItemId) && parsedStockItemId > 0 ? parsedStockItemId : undefined;
  const vendorId = Number.isInteger(parsedVendorId) && parsedVendorId > 0 ? parsedVendorId : undefined;

  const utils = trpc.useUtils();
  const riskQuery = trpc.supplyChainV1.risk.useQuery({ limit: 50 });
  const evaluateMutation = trpc.supplyChainV1.evaluate.useMutation({
    onSuccess: () => {
      toast.success("Supply chain risk evaluation queued");
      utils.supplyChainV1.risk.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Supply Chain Risk</h1>
        <p className="text-muted-foreground">Risk heatmap signals for vendor and stock vulnerability.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Evaluate Risk</CardTitle>
          <CardDescription>Run `supplychain.evaluateRisk` globally or for scoped identifiers.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="stockItemId">Stock Item ID (optional)</Label>
            <Input
              id="stockItemId"
              type="number"
              min={1}
              value={stockItemIdInput}
              onChange={(event) => setStockItemIdInput(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vendorId">Vendor ID (optional)</Label>
            <Input
              id="vendorId"
              type="number"
              min={1}
              value={vendorIdInput}
              onChange={(event) => setVendorIdInput(event.target.value)}
            />
          </div>
          <Button
            disabled={evaluateMutation.isPending}
            onClick={() => evaluateMutation.mutate({ stockItemId, vendorId })}
          >
            {evaluateMutation.isPending ? "Queuing..." : "Evaluate"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Risk Scores</CardTitle>
          <CardDescription>Latest tenant-scoped supply chain risk snapshots.</CardDescription>
        </CardHeader>
        <CardContent>
          {riskQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading risk scores...</p>
          ) : riskQuery.data && riskQuery.data.length > 0 ? (
            <div className="space-y-3">
              {riskQuery.data.map((row) => (
                <div key={row.id} className="rounded-md border p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm">
                      Stock #{row.stockItemId} | Vendor #{row.vendorId}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Risk index {Number(row.supplyChainRiskIndex).toFixed(3)}
                    </p>
                  </div>
                  <Badge className={riskTone(row.riskBand)}>{row.riskBand}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No risk scores generated yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
