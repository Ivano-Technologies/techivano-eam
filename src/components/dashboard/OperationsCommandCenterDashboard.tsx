"use client";

import { Card } from "@/components/ui/card";

interface CommandCenterStats {
  assetRisk: number;
  stockRisk: number;
  complianceAlerts: number;
  maintenanceBacklog: number;
}

export function OperationsCommandCenterDashboard({
  stats,
}: {
  stats: CommandCenterStats;
}) {
  return (
    <Card className="rounded-xl border-border dark:border-dark-border p-4">
      <h3 className="text-sm font-semibold text-text-1 dark:text-dark-text-1">
        Operations Command Center
      </h3>
      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-md bg-rose-500/10 px-3 py-2">
          <p className="text-text-3 dark:text-dark-text-3">Asset Risk</p>
          <p className="text-lg font-semibold">{stats.assetRisk}</p>
        </div>
        <div className="rounded-md bg-amber-500/10 px-3 py-2">
          <p className="text-text-3 dark:text-dark-text-3">Stock Risk</p>
          <p className="text-lg font-semibold">{stats.stockRisk}</p>
        </div>
        <div className="rounded-md bg-indigo-500/10 px-3 py-2">
          <p className="text-text-3 dark:text-dark-text-3">Compliance Alerts</p>
          <p className="text-lg font-semibold">{stats.complianceAlerts}</p>
        </div>
        <div className="rounded-md bg-emerald-500/10 px-3 py-2">
          <p className="text-text-3 dark:text-dark-text-3">Maintenance Backlog</p>
          <p className="text-lg font-semibold">{stats.maintenanceBacklog}</p>
        </div>
      </div>
    </Card>
  );
}
