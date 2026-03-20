import { AlertTriangle, Boxes, PackageCheck, PackageX } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

export default function WarehouseDashboard() {
  const inventoryQuery = trpc.warehouse.inventory.useQuery();
  const lowStockQuery = trpc.warehouse.lowStock.useQuery();
  const trendsQuery = trpc.warehouse.trends.useQuery({ days: 30 });

  const overview = inventoryQuery.data?.overview;
  const lowStockItems = lowStockQuery.data ?? [];
  const trendData = trendsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Warehouse Dashboard</h1>
        <p className="text-muted-foreground">Inventory health, stock risks, and usage trends.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Items</CardDescription>
            <CardTitle className="text-2xl">{formatNumber(overview?.totalItems ?? 0)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-xs text-muted-foreground">
              <Boxes className="mr-1 h-4 w-4" />
              Distinct inventory records
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Units</CardDescription>
            <CardTitle className="text-2xl">{formatNumber(overview?.totalUnits ?? 0)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-xs text-muted-foreground">
              <PackageCheck className="mr-1 h-4 w-4" />
              Units currently in stock
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Low Stock Alerts</CardDescription>
            <CardTitle className="text-2xl">{formatNumber(overview?.lowStockCount ?? 0)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-xs text-amber-700">
              <AlertTriangle className="mr-1 h-4 w-4" />
              Items at or below reorder point
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Out of Stock</CardDescription>
            <CardTitle className="text-2xl">{formatNumber(overview?.outOfStockCount ?? 0)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-xs text-red-700">
              <PackageX className="mr-1 h-4 w-4" />
              Immediate replenishment needed
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Low Stock Alerts</CardTitle>
            <CardDescription>Prioritized by current stock level.</CardDescription>
          </CardHeader>
          <CardContent>
            {lowStockQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading low stock items...</p>
            ) : lowStockItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No low stock alerts right now.</p>
            ) : (
              <div className="space-y-2">
                {lowStockItems.slice(0, 10).map((item) => (
                  <div key={item.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">{item.itemCode}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Stock: {item.currentStock} / Reorder: {item.reorderPoint}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Consumption Trend (30 days)</CardTitle>
            <CardDescription>Daily outbound stock movement.</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            {trendsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading consumption trends...</p>
            ) : trendData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No usage trend data available yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="consumption" stroke="#2563eb" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
