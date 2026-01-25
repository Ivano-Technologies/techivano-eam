import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNaira } from "@/lib/formatNaira";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, Plus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/PullToRefreshIndicator";
import { ShimmerLoader } from "@/components/ShimmerLoader";
import { CheckAnimation } from "@/components/CheckAnimation";

export default function Inventory() {
  const [open, setOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  // Pull-to-refresh for mobile
  const { pullDistance, isRefreshing } = usePullToRefresh({
    onRefresh: async () => {
      await refetch();
      toast.success('Inventory refreshed');
    },
    enabled: true,
  });
  const [formData, setFormData] = useState({
    itemCode: "",
    name: "",
    description: "",
    category: "",
    siteId: "",
    currentStock: "0",
    minStockLevel: "0",
    reorderPoint: "0",
    maxStockLevel: "",
    unitOfMeasure: "",
    unitCost: "",
    supplier: "",
  });

  const utils = trpc.useUtils();
  const { data: items, isLoading, refetch } = trpc.inventory.list.useQuery();
  const { data: lowStock } = trpc.inventory.lowStock.useQuery();
  const { data: sites } = trpc.sites.list.useQuery();

  const createMutation = trpc.inventory.create.useMutation({
    onSuccess: () => {
      setShowSuccess(true);
      toast.success("Inventory item created successfully");
      utils.inventory.list.invalidate();
      utils.inventory.lowStock.invalidate();
      setOpen(false);
      setFormData({
        itemCode: "",
        name: "",
        description: "",
        category: "",
        siteId: "",
        currentStock: "0",
        minStockLevel: "0",
        reorderPoint: "0",
        maxStockLevel: "",
        unitOfMeasure: "",
        unitCost: "",
        supplier: "",
      });
    },
    onError: (error) => {
      toast.error(`Failed to create item: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.itemCode || !formData.name || !formData.siteId) {
      toast.error("Please fill in all required fields");
      return;
    }

    createMutation.mutate({
      itemCode: formData.itemCode,
      name: formData.name,
      description: formData.description || undefined,
      category: formData.category || undefined,
      siteId: parseInt(formData.siteId),
      currentStock: parseInt(formData.currentStock),
      minStockLevel: parseInt(formData.minStockLevel),
      reorderPoint: parseInt(formData.reorderPoint),
      maxStockLevel: formData.maxStockLevel ? parseInt(formData.maxStockLevel) : undefined,
      unitOfMeasure: formData.unitOfMeasure || undefined,
      unitCost: formData.unitCost || undefined,
    });
  };

  if (isLoading) {
    return <ShimmerLoader type="card" count={6} />;
  }

  return (
    <>
      <CheckAnimation show={showSuccess} message="Inventory Item Created!" onComplete={() => setShowSuccess(false)} />
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
      <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold">Inventory Management</h1>
          <p className="text-muted-foreground mt-2">Track spare parts and supplies</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto flex-shrink-0"><Plus className="mr-2 h-4 w-4" />Add Item</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Inventory Item</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="itemCode">Item Code *</Label>
                  <Input
                    id="itemCode"
                    value={formData.itemCode}
                    onChange={(e) => setFormData({ ...formData, itemCode: e.target.value })}
                    placeholder="e.g., INV-001"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Item Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Generator Oil Filter"
                    required
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Item description..."
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="e.g., Filters, Lubricants"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="siteId">Site *</Label>
                  <Select value={formData.siteId} onValueChange={(value) => setFormData({ ...formData, siteId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select site" />
                    </SelectTrigger>
                    <SelectContent>
                      {sites?.map((site) => (
                        <SelectItem key={site.id} value={site.id.toString()}>
                          {site.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currentStock">Current Stock</Label>
                  <Input
                    id="currentStock"
                    type="number"
                    min="0"
                    value={formData.currentStock}
                    onChange={(e) => setFormData({ ...formData, currentStock: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unitOfMeasure">Unit of Measure</Label>
                  <Input
                    id="unitOfMeasure"
                    value={formData.unitOfMeasure}
                    onChange={(e) => setFormData({ ...formData, unitOfMeasure: e.target.value })}
                    placeholder="e.g., pieces, liters, kg"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="minStockLevel">Min Stock Level</Label>
                  <Input
                    id="minStockLevel"
                    type="number"
                    min="0"
                    value={formData.minStockLevel}
                    onChange={(e) => setFormData({ ...formData, minStockLevel: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reorderPoint">Reorder Point</Label>
                  <Input
                    id="reorderPoint"
                    type="number"
                    min="0"
                    value={formData.reorderPoint}
                    onChange={(e) => setFormData({ ...formData, reorderPoint: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxStockLevel">Max Stock Level</Label>
                  <Input
                    id="maxStockLevel"
                    type="number"
                    min="0"
                    value={formData.maxStockLevel}
                    onChange={(e) => setFormData({ ...formData, maxStockLevel: e.target.value })}
                    placeholder="Optional"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unitCost">Unit Cost (₦)</Label>
                  <Input
                    id="unitCost"
                    value={formData.unitCost}
                    onChange={(e) => setFormData({ ...formData, unitCost: e.target.value })}
                    placeholder="e.g., 5000"
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="supplier">Supplier</Label>
                  <Input
                    id="supplier"
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    placeholder="Supplier name"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Add Item"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {lowStock && lowStock.length > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800">
          <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-orange-600" />Low Stock Alerts</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lowStock.map((item) => (
                <div key={item.id} className="flex items-center justify-between">
                  <div><p className="font-medium">{item.name}</p><p className="text-sm text-muted-foreground">Current: {item.currentStock} {item.unitOfMeasure}</p></div>
                  <Badge variant="destructive">Low Stock</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {items?.map((item) => (
          <Card key={item.id}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                <div><CardTitle className="text-lg">{item.name}</CardTitle><p className="text-xs text-muted-foreground">{item.itemCode}</p></div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Stock:</span><span className="font-medium tabular-nums">{item.currentStock} {item.unitOfMeasure}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Reorder Point:</span><span className="tabular-nums">{item.reorderPoint}</span></div>
                {item.unitCost && <div className="flex justify-between"><span className="text-muted-foreground">Unit Cost:</span><span className="font-mono tabular-nums">{formatNaira(item.unitCost)}</span></div>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      </div>
    </>
  );
}
