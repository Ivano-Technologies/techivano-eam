import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Wrench, AlertCircle, History, CheckCircle, Phone, Mail } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useHaptic } from "@/hooks/useHaptic";

interface QuickActionsProps {
  assetId: number;
  assetName: string;
  assetTag: string;
  currentStatus: string;
}

export function QuickActions({ assetId, assetName, assetTag, currentStatus }: QuickActionsProps) {
  const [, setLocation] = useLocation();
  const [isWorkOrderDialogOpen, setIsWorkOrderDialogOpen] = useState(false);
  const [isReportIssueDialogOpen, setIsReportIssueDialogOpen] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [workOrderTitle, setWorkOrderTitle] = useState("");
  const [workOrderDescription, setWorkOrderDescription] = useState("");
  const [workOrderPriority, setWorkOrderPriority] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [issueDescription, setIssueDescription] = useState("");
  const [newStatus, setNewStatus] = useState<string>(currentStatus);
  const { vibrateSuccess, vibrateError } = useHaptic();

  const createWorkOrderMutation = trpc.workOrders.create.useMutation({
    onSuccess: (data) => {
      vibrateSuccess();
      toast.success("Work order created successfully");
      setIsWorkOrderDialogOpen(false);
      setWorkOrderTitle("");
      setWorkOrderDescription("");
      setWorkOrderPriority("medium");
      // Navigate to work order detail
      const created = data as { id?: number } | undefined;
      if (created?.id != null) {
        setLocation(`/work-orders/${created.id}`);
      }
    },
    onError: (error) => {
      vibrateError();
      toast.error(`Failed to create work order: ${error.message}`);
    },
  });

  const updateAssetMutation = trpc.assets.update.useMutation({
    onSuccess: () => {
      vibrateSuccess();
      toast.success("Asset status updated successfully");
      setIsStatusDialogOpen(false);
      window.location.reload(); // Refresh to show updated status
    },
    onError: (error) => {
      vibrateError();
      toast.error(`Failed to update status: ${error.message}`);
    },
  });

  const handleCreateWorkOrder = () => {
    if (!workOrderTitle.trim()) {
      toast.error("Please enter a work order title");
      return;
    }

    // Generate a unique work order number
    const woNumber = `WO-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    createWorkOrderMutation.mutate({
      workOrderNumber: woNumber,
      assetId,
      siteId: 1, // Default site - should be fetched from asset
      title: workOrderTitle,
      description: workOrderDescription,
      type: "corrective",
      priority: workOrderPriority,
    });
  };

  const handleReportIssue = () => {
    if (!issueDescription.trim()) {
      toast.error("Please describe the issue");
      return;
    }

    // Create a high-priority work order for the issue
    const woNumber = `WO-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    createWorkOrderMutation.mutate({
      workOrderNumber: woNumber,
      assetId,
      siteId: 1, // Default site - should be fetched from asset
      title: `Issue Report: ${assetName}`,
      description: issueDescription,
      type: "emergency",
      priority: "high",
    });

    setIsReportIssueDialogOpen(false);
    setIssueDescription("");
  };

  const handleUpdateStatus = () => {
    if (newStatus === currentStatus) {
      toast.info("Status unchanged");
      setIsStatusDialogOpen(false);
      return;
    }

    updateAssetMutation.mutate({
      id: assetId,
      status: newStatus as "operational" | "maintenance" | "retired" | "disposed",
    });
  };

  const handleViewHistory = () => {
    // Scroll to maintenance timeline section
    const timelineElement = document.getElementById("maintenance-timeline");
    if (timelineElement) {
      timelineElement.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      toast.info("Maintenance history section not available");
    }
  };

  const handleContactSupport = () => {
    // For demo purposes, show a toast. In production, this could open email client or phone dialer
    toast.info("Contact support feature - integrate with your support system");
  };

  return (
    <>
      {/* Mobile Quick Actions Bar - Fixed at bottom on mobile, hidden on desktop */}
      <div className="fixed bottom-16 left-0 right-0 z-40 md:hidden bg-background border-t border-border shadow-lg">
        <div className="grid grid-cols-4 gap-1 p-2">
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col items-center gap-1 h-auto py-2"
            onClick={() => setIsWorkOrderDialogOpen(true)}
          >
            <Wrench className="h-5 w-5" />
            <span className="text-xs">Work Order</span>
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col items-center gap-1 h-auto py-2"
            onClick={() => setIsReportIssueDialogOpen(true)}
          >
            <AlertCircle className="h-5 w-5 text-destructive" />
            <span className="text-xs">Report Issue</span>
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col items-center gap-1 h-auto py-2"
            onClick={handleViewHistory}
          >
            <History className="h-5 w-5" />
            <span className="text-xs">History</span>
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col items-center gap-1 h-auto py-2"
            onClick={() => setIsStatusDialogOpen(true)}
          >
            <CheckCircle className="h-5 w-5" />
            <span className="text-xs">Status</span>
          </Button>
        </div>
      </div>

      {/* Desktop Quick Actions - Show as regular buttons */}
      <div className="hidden md:flex gap-2 flex-wrap">
        <Button onClick={() => setIsWorkOrderDialogOpen(true)}>
          <Wrench className="mr-2 h-4 w-4" />
          Create Work Order
        </Button>
        <Button variant="outline" onClick={() => setIsReportIssueDialogOpen(true)}>
          <AlertCircle className="mr-2 h-4 w-4" />
          Report Issue
        </Button>
        <Button variant="outline" onClick={handleViewHistory}>
          <History className="mr-2 h-4 w-4" />
          View History
        </Button>
        <Button variant="outline" onClick={() => setIsStatusDialogOpen(true)}>
          <CheckCircle className="mr-2 h-4 w-4" />
          Update Status
        </Button>
      </div>

      {/* Create Work Order Dialog */}
      <Dialog open={isWorkOrderDialogOpen} onOpenChange={setIsWorkOrderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Work Order</DialogTitle>
            <DialogDescription>
              Create a new work order for {assetName} ({assetTag})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="wo-title">Title *</Label>
              <input
                id="wo-title"
                type="text"
                className="w-full px-3 py-2 border border-input rounded-md"
                placeholder="Brief description of work needed"
                value={workOrderTitle}
                onChange={(e) => setWorkOrderTitle(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="wo-description">Description</Label>
              <Textarea
                id="wo-description"
                placeholder="Detailed description of work to be performed"
                value={workOrderDescription}
                onChange={(e) => setWorkOrderDescription(e.target.value)}
                rows={4}
              />
            </div>
            <div>
              <Label htmlFor="wo-priority">Priority</Label>
              <Select value={workOrderPriority} onValueChange={(value: any) => setWorkOrderPriority(value)}>
                <SelectTrigger id="wo-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsWorkOrderDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateWorkOrder} disabled={createWorkOrderMutation.isPending}>
              {createWorkOrderMutation.isPending ? "Creating..." : "Create Work Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Issue Dialog */}
      <Dialog open={isReportIssueDialogOpen} onOpenChange={setIsReportIssueDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report Issue</DialogTitle>
            <DialogDescription>
              Report a problem with {assetName} ({assetTag})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="issue-description">Issue Description *</Label>
              <Textarea
                id="issue-description"
                placeholder="Describe the issue in detail..."
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
                rows={6}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              This will create a high-priority work order for immediate attention.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReportIssueDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleReportIssue} disabled={createWorkOrderMutation.isPending}>
              {createWorkOrderMutation.isPending ? "Submitting..." : "Submit Issue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Status Dialog */}
      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Asset Status</DialogTitle>
            <DialogDescription>
              Change the operational status of {assetName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-status">New Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger id="new-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operational">Operational</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                  <SelectItem value="disposed">Disposed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">
              Current status: <span className="font-medium">{currentStatus}</span>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStatusDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateStatus} disabled={updateAssetMutation.isPending}>
              {updateAssetMutation.isPending ? "Updating..." : "Update Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
