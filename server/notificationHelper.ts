import * as db from "./db";

/**
 * Helper functions to create notifications for various events
 */

export async function notifyMaintenanceDue(userId: number, assetId: number, assetName: string, dueDate: Date) {
  const prefs = await db.getUserNotificationPreferences(userId);
  if (prefs && !prefs.maintenanceDue) return;

  await db.createNotification({
    userId,
    type: "maintenance_due",
    title: "Maintenance Due Soon",
    message: `Maintenance for ${assetName} is due on ${dueDate.toLocaleDateString()}`,
    relatedEntityType: "asset",
    relatedEntityId: assetId,
  });
}

export async function notifyLowStock(userId: number, itemId: number, itemName: string, currentStock: number) {
  const prefs = await db.getUserNotificationPreferences(userId);
  if (prefs && !prefs.lowStock) return;

  await db.createNotification({
    userId,
    type: "low_stock",
    title: "Low Stock Alert",
    message: `${itemName} is running low (${currentStock} remaining). Please reorder soon.`,
    relatedEntityType: "inventory",
    relatedEntityId: itemId,
  });
}

export async function notifyWorkOrderAssigned(userId: number, workOrderId: number, workOrderTitle: string) {
  const prefs = await db.getUserNotificationPreferences(userId);
  if (prefs && !prefs.workOrderAssigned) return;

  await db.createNotification({
    userId,
    type: "work_order_assigned",
    title: "New Work Order Assigned",
    message: `You have been assigned to work order: ${workOrderTitle}`,
    relatedEntityType: "workOrder",
    relatedEntityId: workOrderId,
  });
}

export async function notifyWorkOrderCompleted(userId: number, workOrderId: number, workOrderTitle: string) {
  const prefs = await db.getUserNotificationPreferences(userId);
  if (prefs && !prefs.workOrderCompleted) return;

  await db.createNotification({
    userId,
    type: "work_order_completed",
    title: "Work Order Completed",
    message: `Work order "${workOrderTitle}" has been completed`,
    relatedEntityType: "workOrder",
    relatedEntityId: workOrderId,
  });
}

export async function notifyAssetStatusChange(userId: number, assetId: number, assetName: string, newStatus: string) {
  const prefs = await db.getUserNotificationPreferences(userId);
  if (prefs && !prefs.assetStatusChange) return;

  await db.createNotification({
    userId,
    type: "asset_status_change",
    title: "Asset Status Changed",
    message: `${assetName} status changed to: ${newStatus}`,
    relatedEntityType: "asset",
    relatedEntityId: assetId,
  });
}

export async function notifyComplianceDue(userId: number, complianceId: number, complianceType: string, dueDate: Date) {
  const prefs = await db.getUserNotificationPreferences(userId);
  if (prefs && !prefs.complianceDue) return;

  await db.createNotification({
    userId,
    type: "compliance_due",
    title: "Compliance Due",
    message: `${complianceType} compliance is due on ${dueDate.toLocaleDateString()}`,
    relatedEntityType: "compliance",
    relatedEntityId: complianceId,
  });
}

export async function notifySystemAlert(userId: number, title: string, message: string) {
  const prefs = await db.getUserNotificationPreferences(userId);
  if (prefs && !prefs.systemAlert) return;

  await db.createNotification({
    userId,
    type: "system_alert",
    title,
    message,
    relatedEntityType: null,
    relatedEntityId: null,
  });
}

/**
 * Check for maintenance due in the next 7 days and notify relevant users
 */
export async function checkAndNotifyUpcomingMaintenance() {
  const upcomingMaintenance = await db.getUpcomingMaintenance(7);
  const users = await db.getAllUsers();
  
  for (const schedule of upcomingMaintenance) {
    if (schedule.assetId && schedule.nextDue) {
      const asset = await db.getAssetById(schedule.assetId);
      if (asset) {
        // Notify all managers and admins
        for (const user of users) {
          if (user.role === "admin" || user.role === "manager") {
            await notifyMaintenanceDue(user.id, asset.id, asset.name, schedule.nextDue);
          }
        }
      }
    }
  }
}

/**
 * Check for low stock items and notify relevant users
 */
export async function checkAndNotifyLowStock() {
  const lowStockItems = await db.getLowStockItems();
  const users = await db.getAllUsers();
  
  for (const item of lowStockItems) {
    // Notify all managers and admins
    for (const user of users) {
      if (user.role === "admin" || user.role === "manager") {
        await notifyLowStock(user.id, item.id, item.name, item.currentStock);
      }
    }
  }
}
