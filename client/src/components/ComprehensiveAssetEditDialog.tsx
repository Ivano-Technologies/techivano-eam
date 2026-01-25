import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

interface ComprehensiveAssetEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: any;
  onUpdate: (data: any) => void;
  isUpdating: boolean;
}

export function ComprehensiveAssetEditDialog({
  open,
  onOpenChange,
  asset,
  onUpdate,
  isUpdating,
}: ComprehensiveAssetEditDialogProps) {
  const [editForm, setEditForm] = useState(() => ({
    name: asset?.name || "",
    description: asset?.description || "",
    status: asset?.status || "",
    manufacturer: asset?.manufacturer || "",
    model: asset?.model || "",
    serialNumber: asset?.serialNumber || "",
    location: asset?.location || "",
    notes: asset?.notes || "",
    // NRCS Fields
    itemType: asset?.itemType || "",
    branchCode: asset?.branchCode || "",
    itemCategoryCode: asset?.itemCategoryCode || "",
    subCategoryId: asset?.subCategory || "",
    methodOfAcquisition: asset?.methodOfAcquisition || "",
    projectReference: asset?.projectReference || "",
    yearAcquired: asset?.yearAcquired || "",
    acquiredCondition: asset?.acquiredCondition || "",
    department: asset?.department || "",
    physicalCheckDate: asset?.lastPhysicalCheckDate || "",
    physicalCheckConductedBy: asset?.checkConductedBy || "",
    // Financial Fields
    acquisitionCost: asset?.acquisitionCost || "",
    currentDepreciatedValue: asset?.currentDepreciatedValue || "",
    warrantyExpiry: asset?.warrantyExpiry || "",
  }));

  const { user } = useAuth();
  const canEditFinancial = user?.role === "admin" || user?.role === "manager";
  const canEditNRCS = user?.role === "admin" || user?.role === "manager";

  const { data: branchCodes } = trpc.nrcs.getBranchCodes.useQuery();
  const { data: categoryCodes } = trpc.nrcs.getCategoryCodes.useQuery();
  const { data: subCategories } = trpc.nrcs.getSubCategories.useQuery({
    type: editForm.itemType as "Asset" | "Inventory",
  });

  const handleSubmit = () => {
    onUpdate({
      id: asset.id,
      name: editForm.name || undefined,
      description: editForm.description || undefined,
      status: editForm.status as any,
      manufacturer: editForm.manufacturer || undefined,
      model: editForm.model || undefined,
      serialNumber: editForm.serialNumber || undefined,
      location: editForm.location || undefined,
      notes: editForm.notes || undefined,
      // NRCS Fields
      itemType: editForm.itemType as any,
      branchCode: editForm.branchCode || undefined,
      itemCategoryCode: editForm.itemCategoryCode || undefined,
      subCategory: editForm.subCategoryId || undefined,
      methodOfAcquisition: editForm.methodOfAcquisition || undefined,
      projectReference: editForm.projectReference || undefined,
      yearAcquired: editForm.yearAcquired ? Number(editForm.yearAcquired) : undefined,
      acquiredCondition: editForm.acquiredCondition as any,
      department: editForm.department || undefined,
      lastPhysicalCheckDate: editForm.physicalCheckDate ? new Date(editForm.physicalCheckDate) : undefined,
      checkConductedBy: editForm.physicalCheckConductedBy || undefined,
      // Financial Fields
      acquisitionCost: editForm.acquisitionCost || undefined,
      currentDepreciatedValue: editForm.currentDepreciatedValue || undefined,
      warrantyExpiry: editForm.warrantyExpiry ? new Date(editForm.warrantyExpiry) : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Asset - {asset?.name}</DialogTitle>
          <DialogDescription>Update all asset information including NRCS details and financial data</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="nrcs" disabled={!canEditNRCS}>NRCS Details {!canEditNRCS && "🔒"}</TabsTrigger>
            <TabsTrigger value="financial" disabled={!canEditFinancial}>Financial {!canEditFinancial && "🔒"}</TabsTrigger>
            <TabsTrigger value="technical">Technical</TabsTrigger>
          </TabsList>

          {/* Basic Info Tab */}
          <TabsContent value="basic" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Asset Name *</Label>
              <Input
                id="name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={editForm.status} onValueChange={(value) => setEditForm({ ...editForm, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
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
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={editForm.location}
                  onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                rows={3}
              />
            </div>
          </TabsContent>

          {/* NRCS Details Tab */}
          <TabsContent value="nrcs" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="itemType">Item Type</Label>
                <Select value={editForm.itemType} onValueChange={(value) => setEditForm({ ...editForm, itemType: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Asset">Asset</SelectItem>
                    <SelectItem value="Inventory">Inventory</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="branchCode">Branch Code</Label>
                <Select value={editForm.branchCode} onValueChange={(value) => setEditForm({ ...editForm, branchCode: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branchCodes?.map((branch) => (
                      <SelectItem key={branch.code} value={branch.code}>
                        {branch.code} - {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="itemCategoryCode">Category Code</Label>
                <Select value={editForm.itemCategoryCode} onValueChange={(value) => setEditForm({ ...editForm, itemCategoryCode: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryCodes?.map((cat) => (
                      <SelectItem key={cat.code} value={cat.code}>
                        {cat.code} - {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subCategoryId">Sub-Category</Label>
                <Select value={editForm.subCategoryId} onValueChange={(value) => setEditForm({ ...editForm, subCategoryId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select sub-category" />
                  </SelectTrigger>
                  <SelectContent>
                    {subCategories?.map((sub) => (
                      <SelectItem key={sub.id} value={sub.id.toString()}>
                        {sub.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="methodOfAcquisition">Method of Acquisition</Label>
                <Select value={editForm.methodOfAcquisition} onValueChange={(value) => setEditForm({ ...editForm, methodOfAcquisition: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ICRC">ICRC</SelectItem>
                    <SelectItem value="IFRC">IFRC</SelectItem>
                    <SelectItem value="Other Donor">Other Donor</SelectItem>
                    <SelectItem value="Project">Project</SelectItem>
                    <SelectItem value="Internal">Internal</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="yearAcquired">Year Acquired</Label>
                <Input
                  id="yearAcquired"
                  type="number"
                  value={editForm.yearAcquired}
                  onChange={(e) => setEditForm({ ...editForm, yearAcquired: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="acquiredCondition">Acquired Condition</Label>
                <Select value={editForm.acquiredCondition} onValueChange={(value) => setEditForm({ ...editForm, acquiredCondition: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select condition" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="New">New</SelectItem>
                    <SelectItem value="Used">Used</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  value={editForm.department}
                  onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="projectReference">Project Reference/Name</Label>
              <Input
                id="projectReference"
                value={editForm.projectReference}
                onChange={(e) => setEditForm({ ...editForm, projectReference: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="physicalCheckDate">Physical Check Date</Label>
                <Input
                  id="physicalCheckDate"
                  type="date"
                  value={editForm.physicalCheckDate ? new Date(editForm.physicalCheckDate).toISOString().split('T')[0] : ''}
                  onChange={(e) => setEditForm({ ...editForm, physicalCheckDate: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="physicalCheckConductedBy">Conducted By</Label>
                <Input
                  id="physicalCheckConductedBy"
                  value={editForm.physicalCheckConductedBy}
                  onChange={(e) => setEditForm({ ...editForm, physicalCheckConductedBy: e.target.value })}
                />
              </div>
            </div>
          </TabsContent>

          {/* Financial Tab */}
          <TabsContent value="financial" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="acquisitionCost">Acquisition Cost (NGN)</Label>
                <Input
                  id="acquisitionCost"
                  value={editForm.acquisitionCost}
                  onChange={(e) => setEditForm({ ...editForm, acquisitionCost: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="currentDepreciatedValue">Current Depreciated Value (NGN)</Label>
                <Input
                  id="currentDepreciatedValue"
                  value={editForm.currentDepreciatedValue}
                  onChange={(e) => setEditForm({ ...editForm, currentDepreciatedValue: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="warrantyExpiry">Warranty Expiry Date</Label>
              <Input
                id="warrantyExpiry"
                type="date"
                value={editForm.warrantyExpiry ? new Date(editForm.warrantyExpiry).toISOString().split('T')[0] : ''}
                onChange={(e) => setEditForm({ ...editForm, warrantyExpiry: e.target.value })}
              />
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">Depreciation Information</h4>
              <p className="text-sm text-muted-foreground">
                Depreciation rates are automatically calculated based on the category code:
              </p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                <li>• Motor Vehicles: 20% per year (5 years)</li>
                <li>• Furniture & Fixtures: 10% per year (10 years)</li>
                <li>• IT Equipment: 33% per year (3 years)</li>
                <li>• Buildings: 2% per year (50 years)</li>
              </ul>
            </div>
          </TabsContent>

          {/* Technical Tab */}
          <TabsContent value="technical" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="manufacturer">Manufacturer</Label>
                <Input
                  id="manufacturer"
                  value={editForm.manufacturer}
                  onChange={(e) => setEditForm({ ...editForm, manufacturer: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  value={editForm.model}
                  onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="serialNumber">Serial Number</Label>
              <Input
                id="serialNumber"
                value={editForm.serialNumber}
                onChange={(e) => setEditForm({ ...editForm, serialNumber: e.target.value })}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isUpdating}>
            {isUpdating ? "Updating..." : "Update Asset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
