import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Wrench, AlertTriangle, DollarSign, Calendar, TrendingUp } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Home() {
  const { data: stats, isLoading } = trpc.dashboard.stats.useQuery();
  const { data: upcomingMaintenance } = trpc.maintenance.upcoming.useQuery({ days: 7 });
  const { data: lowStockItems } = trpc.inventory.lowStock.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const metrics = [
    {
      title: "Total Assets",
      value: stats?.totalAssets || 0,
      icon: Package,
      description: `${stats?.operationalAssets || 0} operational`,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Assets in Maintenance",
      value: stats?.maintenanceAssets || 0,
      icon: Wrench,
      description: "Currently being serviced",
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      title: "Pending Work Orders",
      value: stats?.pendingWorkOrders || 0,
      icon: AlertTriangle,
      description: `${stats?.inProgressWorkOrders || 0} in progress`,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      title: "Low Stock Items",
      value: stats?.lowStockItems || 0,
      icon: TrendingUp,
      description: "Need reordering",
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Overview of your asset management system
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {metric.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${metric.bgColor}`}>
                  <Icon className={`h-4 w-4 ${metric.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metric.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {metric.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Two Column Layout */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Upcoming Maintenance */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Upcoming Maintenance</CardTitle>
                <CardDescription>Next 7 days</CardDescription>
              </div>
              <Calendar className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {upcomingMaintenance && upcomingMaintenance.length > 0 ? (
              <div className="space-y-3">
                {upcomingMaintenance.slice(0, 5).map((schedule) => (
                  <div key={schedule.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{schedule.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Due: {new Date(schedule.nextDue).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
                <Link href="/maintenance">
                  <Button variant="outline" size="sm" className="w-full">
                    View All Schedules
                  </Button>
                </Link>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No upcoming maintenance scheduled</p>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Low Stock Alerts</CardTitle>
                <CardDescription>Items below reorder point</CardDescription>
              </div>
              <AlertTriangle className="h-5 w-5 text-orange-600" />
            </div>
          </CardHeader>
          <CardContent>
            {lowStockItems && lowStockItems.length > 0 ? (
              <div className="space-y-3">
                {lowStockItems.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Stock: {item.currentStock} {item.unitOfMeasure}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-orange-600">
                      Reorder
                    </span>
                  </div>
                ))}
                <Link href="/inventory">
                  <Button variant="outline" size="sm" className="w-full">
                    View Inventory
                  </Button>
                </Link>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">All inventory levels are adequate</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks and shortcuts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link href="/assets">
              <Button variant="outline" className="w-full justify-start">
                <Package className="mr-2 h-4 w-4" />
                View Assets
              </Button>
            </Link>
            <Link href="/work-orders">
              <Button variant="outline" className="w-full justify-start">
                <Wrench className="mr-2 h-4 w-4" />
                Work Orders
              </Button>
            </Link>
            <Link href="/maintenance">
              <Button variant="outline" className="w-full justify-start">
                <Calendar className="mr-2 h-4 w-4" />
                Maintenance
              </Button>
            </Link>
            <Link href="/inventory">
              <Button variant="outline" className="w-full justify-start">
                <TrendingUp className="mr-2 h-4 w-4" />
                Inventory
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
