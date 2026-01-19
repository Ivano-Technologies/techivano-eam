import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, Plus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function Inventory() {
  const { data: items, isLoading } = trpc.inventory.list.useQuery();
  const { data: lowStock } = trpc.inventory.lowStock.useQuery();

  if (isLoading) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold">Inventory Management</h1><p className="text-muted-foreground mt-2">Track spare parts and supplies</p></div>
        <Button onClick={() => toast.info("Feature coming soon")}><Plus className="mr-2 h-4 w-4" />Add Item</Button>
      </div>
      {lowStock && lowStock.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                <div className="flex justify-between"><span className="text-muted-foreground">Stock:</span><span className="font-medium">{item.currentStock} {item.unitOfMeasure}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Reorder Point:</span><span>{item.reorderPoint}</span></div>
                {item.unitCost && <div className="flex justify-between"><span className="text-muted-foreground">Unit Cost:</span><span>₦{parseFloat(item.unitCost).toLocaleString()}</span></div>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
