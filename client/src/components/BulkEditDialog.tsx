import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface BulkEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedAssetIds: number[];
  onSuccess: () => void;
}

export function BulkEditDialog({ open, onOpenChange, selectedAssetIds, onSuccess }: BulkEditDialogProps) {
  const [bulkEditData, setBulkEditData] = useState({
    status: "",
    location: "",
    department: "",
  });

  const bulkUpdateMutation = trpc.assets.bulkUpdate.useMutation({
    onSuccess: (result: { updated: number; total: number }) => {
      toast.success(`Successfully updated ${result.updated} asset(s)`);
      onSuccess();
      onOpenChange(false);
      setBulkEditData({ status: "", location: "", department: "" });
    },
    onError: (error: any) => {
      toast.error(`Failed to update assets: ${error.message}`);
    },
  });

  const handleBulkUpdate = () => {
    // Only include fields that have been set
    const updates: any = {};
    if (bulkEditData.status) updates.status = bulkEditData.status;
    if (bulkEditData.location) updates.location = bulkEditData.location;
    if (bulkEditData.department) updates.department = bulkEditData.department;

    if (Object.keys(updates).length === 0) {
      toast.error("Please select at least one field to update");
      return;
    }

    bulkUpdateMutation.mutate({
      assetIds: selectedAssetIds,
      updates,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Bulk Edit Assets</DialogTitle>
          <DialogDescription>
            Update {selectedAssetIds.length} selected asset(s). Only fields you change will be updated.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="bulk-status">Status</Label>
            <Select
              value={bulkEditData.status}
              onValueChange={(value) => setBulkEditData({ ...bulkEditData, status: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Leave unchanged" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="operational">Operational</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="repair">Repair</SelectItem>
                <SelectItem value="retired">Retired</SelectItem>
                <SelectItem value="disposed">Disposed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulk-location">Location</Label>
            <Input
              id="bulk-location"
              placeholder="Leave unchanged"
              value={bulkEditData.location}
              onChange={(e) => setBulkEditData({ ...bulkEditData, location: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulk-department">Department</Label>
            <Input
              id="bulk-department"
              placeholder="Leave unchanged"
              value={bulkEditData.department}
              onChange={(e) => setBulkEditData({ ...bulkEditData, department: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleBulkUpdate} disabled={bulkUpdateMutation.isPending}>
            {bulkUpdateMutation.isPending ? "Updating..." : `Update ${selectedAssetIds.length} Asset(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
