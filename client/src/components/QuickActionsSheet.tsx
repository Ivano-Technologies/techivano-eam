import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Wrench, AlertCircle, History, RefreshCw } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useHaptic } from "@/hooks/useHaptic";
import { BottomSheet } from "@/components/BottomSheet";
import { useIsMobile } from "@/hooks/useIsMobile";

interface QuickActionsSheetProps {
  assetId: number;
  assetName: string;
  assetTag: string;
  currentStatus: string;
}

export function QuickActionsSheet({ assetId, assetName, assetTag, currentStatus }: QuickActionsSheetProps) {
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const [activeAction, setActiveAction] = useState<'main' | 'work_order' | 'issue' | 'status'>('main');
  
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
      resetForm();
      setIsOpen(false);
      if (data) {
        setLocation(`/work-orders/${data.id}`);
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
      resetForm();
      setIsOpen(false);
      window.location.reload();
    },
    onError: (error) => {
      vibrateError();
      toast.error(`Failed to update status: ${error.message}`);
    },
  });

  const resetForm = () => {
    setActiveAction('main');
    setWorkOrderTitle("");
    setWorkOrderDescription("");
    setWorkOrderPriority("medium");
    setIssueDescription("");
    setNewStatus(currentStatus);
  };

  const handleCreateWorkOrder = () => {
    if (!workOrderTitle.trim()) {
      toast.error("Please enter a work order title");
      return;
    }

    const woNumber = `WO-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    createWorkOrderMutation.mutate({
      workOrderNumber: woNumber,
      assetId,
      siteId: 1,
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

    const woNumber = `WO-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    createWorkOrderMutation.mutate({
      workOrderNumber: woNumber,
      assetId,
      siteId: 1,
      title: `Issue Report: ${assetName}`,
      description: issueDescription,
      type: "emergency",
      priority: "high",
    });
  };

  const handleUpdateStatus = () => {
    if (newStatus === currentStatus) {
      toast.info("Status unchanged");
      setIsOpen(false);
      return;
    }

    updateAssetMutation.mutate({
      id: assetId,
      status: newStatus as "operational" | "maintenance" | "retired" | "disposed",
    });
  };

  const handleViewHistory = () => {
    const element = document.getElementById('maintenance-timeline');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setIsOpen(false);
    }
  };

  // Only show on mobile
  if (!isMobile) {
    return null;
  }

  return (
    <>
      {/* Trigger Button */}
      <Button
        onClick={() => setIsOpen(true)}
        className="w-full md:hidden gap-2"
        size="lg"
      >
        <Wrench className="h-5 w-5" />
        Quick Actions
      </Button>

      {/* Bottom Sheet */}
      <BottomSheet
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          resetForm();
        }}
        title={activeAction === 'main' ? 'Quick Actions' : ''}
        snapPoints={[0.7]}
      >
        <div className="px-6 py-4">
          {/* Main Menu */}
          {activeAction === 'main' && (
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full h-16 justify-start gap-4 text-lg"
                onClick={() => setActiveAction('work_order')}
              >
                <Wrench className="h-6 w-6 text-blue-600" />
                Create Work Order
              </Button>
              <Button
                variant="outline"
                className="w-full h-16 justify-start gap-4 text-lg"
                onClick={() => setActiveAction('issue')}
              >
                <AlertCircle className="h-6 w-6 text-red-600" />
                Report Issue
              </Button>
              <Button
                variant="outline"
                className="w-full h-16 justify-start gap-4 text-lg"
                onClick={() => setActiveAction('status')}
              >
                <RefreshCw className="h-6 w-6 text-green-600" />
                Update Status
              </Button>
              <Button
                variant="outline"
                className="w-full h-16 justify-start gap-4 text-lg"
                onClick={handleViewHistory}
              >
                <History className="h-6 w-6 text-purple-600" />
                View History
              </Button>
            </div>
          )}

          {/* Create Work Order Form */}
          {activeAction === 'work_order' && (
            <div className="space-y-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveAction('main')}
                className="mb-2"
              >
                ← Back
              </Button>
              <h3 className="text-xl font-bold">Create Work Order</h3>
              <div className="space-y-3">
                <div>
                  <Label>Title</Label>
                  <Input
                    value={workOrderTitle}
                    onChange={(e) => setWorkOrderTitle(e.target.value)}
                    placeholder="Enter work order title"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={workOrderDescription}
                    onChange={(e) => setWorkOrderDescription(e.target.value)}
                    placeholder="Describe the work needed"
                    rows={3}
                  />
                </div>
                <div>
                  <Label>Priority</Label>
                  <Select value={workOrderPriority} onValueChange={(v: any) => setWorkOrderPriority(v)}>
                    <SelectTrigger>
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
                <Button
                  onClick={handleCreateWorkOrder}
                  disabled={createWorkOrderMutation.isPending}
                  className="w-full"
                  size="lg"
                >
                  {createWorkOrderMutation.isPending ? "Creating..." : "Create Work Order"}
                </Button>
              </div>
            </div>
          )}

          {/* Report Issue Form */}
          {activeAction === 'issue' && (
            <div className="space-y-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveAction('main')}
                className="mb-2"
              >
                ← Back
              </Button>
              <h3 className="text-xl font-bold">Report Issue</h3>
              <div className="space-y-3">
                <div>
                  <Label>Issue Description</Label>
                  <Textarea
                    value={issueDescription}
                    onChange={(e) => setIssueDescription(e.target.value)}
                    placeholder="Describe the issue in detail"
                    rows={5}
                  />
                </div>
                <Button
                  onClick={handleReportIssue}
                  disabled={createWorkOrderMutation.isPending}
                  className="w-full"
                  size="lg"
                  variant="destructive"
                >
                  {createWorkOrderMutation.isPending ? "Reporting..." : "Report Issue"}
                </Button>
              </div>
            </div>
          )}

          {/* Update Status Form */}
          {activeAction === 'status' && (
            <div className="space-y-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveAction('main')}
                className="mb-2"
              >
                ← Back
              </Button>
              <h3 className="text-xl font-bold">Update Status</h3>
              <div className="space-y-3">
                <div>
                  <Label>Current Status: {currentStatus}</Label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger>
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
                <Button
                  onClick={handleUpdateStatus}
                  disabled={updateAssetMutation.isPending}
                  className="w-full"
                  size="lg"
                >
                  {updateAssetMutation.isPending ? "Updating..." : "Update Status"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </BottomSheet>
    </>
  );
}
