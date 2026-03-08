import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

function bandClass(band: string) {
  if (band === "high") return "bg-red-100 text-red-800 border-red-300";
  if (band === "medium") return "bg-yellow-100 text-yellow-800 border-yellow-300";
  return "bg-green-100 text-green-800 border-green-300";
}

export default function VendorIntelligenceDashboard() {
  const [vendorIdInput, setVendorIdInput] = useState("");
  const parsedVendorId = Number(vendorIdInput);
  const validVendorId = Number.isInteger(parsedVendorId) && parsedVendorId > 0 ? parsedVendorId : undefined;

  const utils = trpc.useUtils();
  const riskQuery = trpc.vendorIntelligence.riskScores.useQuery({ limit: 50 });
  const computeMutation = trpc.vendorIntelligence.compute.useMutation({
    onSuccess: () => {
      toast.success("Vendor intelligence job queued");
      utils.vendorIntelligence.riskScores.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Vendor Intelligence</h1>
        <p className="text-muted-foreground">Deterministic vendor scoring and risk signals.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Compute Scores</CardTitle>
          <CardDescription>Run `vendor.computeRiskScores` for all vendors or one vendor ID.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="vendorId">Vendor ID (optional)</Label>
            <Input
              id="vendorId"
              type="number"
              min={1}
              placeholder="Leave blank for all"
              value={vendorIdInput}
              onChange={(event) => setVendorIdInput(event.target.value)}
              className="w-64"
            />
          </div>
          <Button
            disabled={computeMutation.isPending}
            onClick={() => {
              computeMutation.mutate({
                vendorId: validVendorId,
              });
            }}
          >
            {computeMutation.isPending ? "Queuing..." : "Run Vendor Agent"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vendor Risk Scores</CardTitle>
          <CardDescription>Latest tenant-scoped vendor risk outputs.</CardDescription>
        </CardHeader>
        <CardContent>
          {riskQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading risk scores...</p>
          ) : riskQuery.data && riskQuery.data.length > 0 ? (
            <div className="space-y-3">
              {riskQuery.data.map((row) => (
                <div
                  key={row.id}
                  className="rounded-md border p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <p className="text-sm">
                      <span className="font-medium">Vendor ID:</span> #{row.vendorId}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Vendor Score {Number(row.vendorScore).toFixed(3)} | Risk Score {Number(row.riskScore).toFixed(3)}
                    </p>
                  </div>
                  <Badge className={bandClass(row.riskBand)}>{row.riskBand}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No risk scores available yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
