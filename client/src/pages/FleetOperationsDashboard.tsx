import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

function priorityTone(priority: string) {
  if (priority === "critical") return "bg-red-200 text-red-900 border-red-400";
  if (priority === "urgent") return "bg-orange-100 text-orange-800 border-orange-300";
  if (priority === "prioritized") return "bg-yellow-100 text-yellow-800 border-yellow-300";
  return "bg-green-100 text-green-800 border-green-300";
}

export default function FleetOperationsDashboard() {
  const [workOrderIdInput, setWorkOrderIdInput] = useState("");
  const [facilityIdInput, setFacilityIdInput] = useState("");
  const parsedWorkOrderId = Number(workOrderIdInput);
  const parsedFacilityId = Number(facilityIdInput);
  const workOrderId = Number.isInteger(parsedWorkOrderId) && parsedWorkOrderId > 0 ? parsedWorkOrderId : undefined;
  const facilityId = Number.isInteger(parsedFacilityId) && parsedFacilityId > 0 ? parsedFacilityId : undefined;

  const utils = trpc.useUtils();
  const assignmentsQuery = trpc.dispatchV1.assignments.useQuery({ limit: 50 });
  const optimizeMutation = trpc.dispatchV1.optimize.useMutation({
    onSuccess: () => {
      toast.success("Dispatch optimization queued");
      utils.dispatchV1.assignments.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Fleet Operations</h1>
        <p className="text-muted-foreground">Technician dispatch and fleet utilization optimization.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Optimize Dispatch</CardTitle>
          <CardDescription>Trigger `dispatch.optimizeAssignments` for all pending work or scoped IDs.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="workOrderId">Work Order ID (optional)</Label>
            <Input
              id="workOrderId"
              type="number"
              min={1}
              value={workOrderIdInput}
              onChange={(event) => setWorkOrderIdInput(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="facilityId">Facility ID (optional)</Label>
            <Input
              id="facilityId"
              type="number"
              min={1}
              value={facilityIdInput}
              onChange={(event) => setFacilityIdInput(event.target.value)}
            />
          </div>
          <Button
            disabled={optimizeMutation.isPending}
            onClick={() => optimizeMutation.mutate({ workOrderId, facilityId })}
          >
            {optimizeMutation.isPending ? "Queuing..." : "Optimize"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dispatch Queue</CardTitle>
          <CardDescription>Active dispatch assignments, travel estimates, and priority.</CardDescription>
        </CardHeader>
        <CardContent>
          {assignmentsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading assignments...</p>
          ) : assignmentsQuery.data && assignmentsQuery.data.length > 0 ? (
            <div className="space-y-3">
              {assignmentsQuery.data.map((row) => (
                <div key={row.id} className="rounded-md border p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm">
                      Work order #{row.workOrderId} | Technician #{row.technicianId} | Fleet #{row.fleetUnitId}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Travel {Number(row.estimatedTravelTime).toFixed(1)} min | Distance {Number(row.routeDistance).toFixed(1)} km
                    </p>
                  </div>
                  <Badge className={priorityTone(row.dispatchPriority)}>{row.dispatchPriority}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No dispatch assignments yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
