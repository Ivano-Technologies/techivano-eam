import * as inventoryDb from "../db/inventory";
import * as analyticsDb from "../db/analytics";

type InventoryOverview = {
  totalItems: number;
  totalUnits: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalValue: number;
};

export async function getInventoryLevels(organizationId?: string | null) {
  const items = await inventoryDb.getAllInventoryItems(undefined, organizationId ?? undefined);

  const overview = items.reduce<InventoryOverview>(
    (acc, item) => {
      acc.totalItems += 1;
      acc.totalUnits += Number(item.currentStock ?? 0);
      acc.totalValue += Number(item.currentStock ?? 0) * Number(item.unitCost ?? 0);
      if (Number(item.currentStock ?? 0) <= Number(item.reorderPoint ?? 0)) {
        acc.lowStockCount += 1;
      }
      if (Number(item.currentStock ?? 0) <= 0) {
        acc.outOfStockCount += 1;
      }
      return acc;
    },
    {
      totalItems: 0,
      totalUnits: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
      totalValue: 0,
    },
  );

  return {
    overview: {
      ...overview,
      totalValue: Number(overview.totalValue.toFixed(2)),
    },
    items,
  };
}

export async function getLowStockItems(organizationId?: string | null, siteId?: number) {
  const items = await inventoryDb.getAllInventoryItems(siteId, organizationId ?? undefined);
  return items
    .filter((item) => Number(item.currentStock ?? 0) <= Number(item.reorderPoint ?? 0))
    .sort((a, b) => Number(a.currentStock ?? 0) - Number(b.currentStock ?? 0));
}

export async function getConsumptionTrends(params?: {
  organizationId?: string | null;
  siteId?: number;
  days?: number;
}) {
  return analyticsDb.getInventoryConsumptionTrends({
    organizationId: params?.organizationId,
    siteId: params?.siteId,
    days: params?.days,
  });
}
