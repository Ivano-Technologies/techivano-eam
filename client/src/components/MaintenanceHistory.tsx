import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock, User, Wrench, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { Link } from "wouter";
import { ShimmerLoader } from "./ShimmerLoader";

interface MaintenanceHistoryProps {
  assetId: number;
}

interface WorkOrderEntry {
  id: number;
  status?: string;
  type?: string;
  title?: string;
  description?: string;
  priority?: string;
  scheduledStart?: Date | string | null;
  actualStart?: Date | string | null;
  actualEnd?: Date | string | null;
  workOrderNumber?: string;
}

export function MaintenanceHistory({ assetId }: MaintenanceHistoryProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: byAssetData, isLoading } = trpc.workOrders.getByAssetId.useQuery({ assetId });
  const workOrders: WorkOrderEntry[] = Array.isArray(byAssetData?.workOrders)
    ? (byAssetData.workOrders as WorkOrderEntry[])
    : [];
  const summary = byAssetData?.summary ?? { total: 0, completed: 0, completionRatePct: 0, avgDurationDays: null };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Maintenance History</CardTitle>
        </CardHeader>
        <CardContent>
          <ShimmerLoader />
        </CardContent>
      </Card>
    );
  }

  if (!workOrders || workOrders.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Maintenance History</CardTitle>
          <CardDescription>All work orders and maintenance activities for this asset</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Wrench className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No maintenance history found for this asset</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Filter work orders (UI-only; counts come from server summary)
  const filteredWorkOrders = workOrders.filter((wo) => {
    if (statusFilter !== "all" && wo.status !== statusFilter) return false;
    if (typeFilter !== "all" && wo.type !== typeFilter) return false;
    return true;
  });

  // Use server-precomputed KPIs (no client-side aggregation)
  const totalWorkOrders = summary.total;
  const completedWorkOrders = summary.completed;
  const completionRate = String(summary.completionRatePct);
  const avgDurationDays = summary.avgDurationDays != null ? String(summary.avgDurationDays) : "0";

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "in_progress":
        return <Clock className="h-4 w-4 text-blue-600" />;
      case "cancelled":
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getStatusBadge = (status: string | undefined) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      completed: "default",
      in_progress: "secondary",
      cancelled: "destructive",
      pending: "outline",
      assigned: "outline",
      on_hold: "outline",
    };
    return (
      <Badge variant={variants[status ?? ""] || "outline"} className="capitalize">
        {(status ?? "").replace("_", " ")}
      </Badge>
    );
  };

  const getTypeBadge = (type: string | undefined) => {
    const colors: Record<string, string> = {
      corrective: "bg-red-100 text-red-800 border-red-200",
      preventive: "bg-green-100 text-green-800 border-green-200",
      inspection: "bg-blue-100 text-blue-800 border-blue-200",
      emergency: "bg-orange-100 text-orange-800 border-orange-200",
    };
    return (
      <Badge variant="outline" className={`capitalize ${colors[type ?? ""] || ""}`}>
        {type ?? ""}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string | undefined) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      critical: "destructive",
      high: "destructive",
      medium: "secondary",
      low: "outline",
    };
    return (
      <Badge variant={variants[priority ?? ""] || "outline"} className="capitalize">
        {priority ?? ""}
      </Badge>
    );
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Maintenance History</CardTitle>
            <CardDescription>All work orders and maintenance activities for this asset</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Statistics Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="p-4 border rounded-lg">
            <div className="text-sm text-muted-foreground">Total Work Orders</div>
            <div className="text-2xl font-bold">{totalWorkOrders}</div>
          </div>
          <div className="p-4 border rounded-lg">
            <div className="text-sm text-muted-foreground">Completion Rate</div>
            <div className="text-2xl font-bold">{completionRate}%</div>
            <div className="text-xs text-muted-foreground">{completedWorkOrders} completed</div>
          </div>
          <div className="p-4 border rounded-lg">
            <div className="text-sm text-muted-foreground">Avg Duration</div>
            <div className="text-2xl font-bold">{avgDurationDays}</div>
            <div className="text-xs text-muted-foreground">days</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="corrective">Corrective</SelectItem>
              <SelectItem value="preventive">Preventive</SelectItem>
              <SelectItem value="inspection">Inspection</SelectItem>
              <SelectItem value="emergency">Emergency</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Work Orders List */}
        <div className="space-y-4">
          {filteredWorkOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No work orders match the selected filters</p>
            </div>
          ) : (
            filteredWorkOrders.map((workOrder) => (
              <Link key={workOrder.id} href={`/work-orders/${workOrder.id}`}>
                <div className="p-4 border rounded-lg hover:bg-accent transition-colors cursor-pointer">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getStatusIcon(workOrder.status ?? "")}
                        <h4 className="font-semibold">{workOrder.title}</h4>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {workOrder.description || "No description provided"}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 items-end ml-4">
                      {getStatusBadge(workOrder.status ?? "")}
                      {getTypeBadge(workOrder.type ?? undefined)}
                      {getPriorityBadge(workOrder.priority ?? undefined)}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <div>
                        <div className="text-xs">Scheduled</div>
                        <div className="font-medium text-foreground">
                          {formatDate(workOrder.scheduledStart ?? null)}
                        </div>
                      </div>
                    </div>
                    
                    {workOrder.actualStart && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <div>
                          <div className="text-xs">Started</div>
                          <div className="font-medium text-foreground">
                            {formatDate(workOrder.actualStart ?? null)}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {workOrder.actualEnd && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4" />
                        <div>
                          <div className="text-xs">Completed</div>
                          <div className="font-medium text-foreground">
                            {formatDate(workOrder.actualEnd ?? null)}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="h-4 w-4" />
                      <div>
                        <div className="text-xs">Work Order #</div>
                        <div className="font-medium text-foreground">
                          {workOrder.workOrderNumber}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
