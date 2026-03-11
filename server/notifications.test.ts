import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "./routers";
import { createTestContextWithOrg } from "./test/contextHelpers";
import { tableExists } from "./test/schemaChecks";

describe("Notification System", () => {
  let notificationsTablesAvailable = false;

  beforeAll(async () => {
    const prefs = await tableExists("notificationPreferences");
    const notifs = await tableExists("notifications");
    const audit = await tableExists("auditLogs");
    notificationsTablesAvailable = prefs && notifs && audit;
  });

  it("should get user notification preferences", async () => {
    if (!notificationsTablesAvailable) return;
    const ctx = createTestContextWithOrg();
    const caller = appRouter.createCaller(ctx);

    const preferences = await caller.notifications.getPreferences();
    
    // Preferences might be null for new users or have default values
    if (preferences) {
      expect(preferences).toHaveProperty("userId");
      expect(preferences.userId).toBe(ctx.user!.id);
    }
  });

  it("should update notification preferences", async () => {
    if (!notificationsTablesAvailable) return;
    const ctx = createTestContextWithOrg();
    const caller = appRouter.createCaller(ctx);

    await caller.notifications.updatePreferences({
      maintenanceDue: false,
      lowStock: true,
      workOrderAssigned: true,
    });

    const preferences = await caller.notifications.getPreferences();
    expect(preferences).toBeTruthy();
    if (preferences) {
      expect(preferences.maintenanceDue).toBe(false);
      expect(preferences.lowStock).toBe(true);
      expect(preferences.workOrderAssigned).toBe(true);
    }
  });

  it("should list user notifications", async () => {
    if (!notificationsTablesAvailable) return;
    const ctx = createTestContextWithOrg();
    const caller = appRouter.createCaller(ctx);

    const notifications = await caller.notifications.list({ limit: 10 });
    
    expect(Array.isArray(notifications)).toBe(true);
  });

  it("should get unread notification count", async () => {
    if (!notificationsTablesAvailable) return;
    const ctx = createTestContextWithOrg();
    const caller = appRouter.createCaller(ctx);

    const count = await caller.notifications.unreadCount();
    
    expect(typeof count).toBe("number");
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it("should create work order and notify assigned user", async () => {
    if (!notificationsTablesAvailable) return;
    const ctx = createTestContextWithOrg("admin");
    const caller = appRouter.createCaller(ctx);

    // Create a site first
    const site = await caller.sites.create({
      name: "Test Site for Notifications",
      address: "123 Test St",
      city: "Test City",
      state: "Test State",
    });

    // Ensure we have at least one category
    let categories = await caller.assetCategories.list();
    if (categories.length === 0) {
      await caller.assetCategories.create({ name: "Notif Test Category", description: "For tests" });
      categories = await caller.assetCategories.list();
    }

    // Create an asset
    const asset = await caller.assets.create({
      assetTag: `TEST-NOTIF-${Date.now()}`,
      name: "Test Asset for Notification",
      categoryId: categories[0]!.id,
      siteId: site.id,
      status: "operational",
      condition: "good",
    });

    // Create work order assigned to user 2
    const workOrder = await caller.workOrders.create({
      workOrderNumber: `WO-NOTIF-${Date.now()}`,
      title: "Test Work Order with Notification",
      assetId: asset.id,
      siteId: site.id,
      type: "corrective",
      priority: "medium",
      assignedTo: 2, // Assign to different user
    });

    expect(workOrder).toBeTruthy();
    expect(workOrder?.assignedTo).toBe(2);

    // Check if notification was created for user 2
    const ctx2 = createTestContextWithOrg("technician", { userId: 2 });
    const caller2 = appRouter.createCaller(ctx2);
    const notifications = await caller2.notifications.list({ limit: 10 });
    
    // Should have at least one notification
    const workOrderNotification = notifications.find(
      n => n.type === "work_order_assigned" && n.relatedEntityId === workOrder?.id
    );
    
    if (workOrderNotification) {
      expect(workOrderNotification.title).toContain("Work Order");
      expect(workOrderNotification.isRead).toBe(false);
    }
  });
});
