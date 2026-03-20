// @ts-nocheck — split from server/db.ts; schema uses pg-core; runtime Supabase Postgres
import { eq, and, desc, asc, gte, lte, sql, or, like, isNotNull, isNull } from "drizzle-orm";
import {
  InsertUser, users, sites, InsertSite, assetCategories, assets, InsertAsset,
  workOrders, InsertWorkOrder, maintenanceSchedules, InsertMaintenanceSchedule,
  inventoryItems, InsertInventoryItem, inventoryTransactions, vendors, InsertVendor,
  financialTransactions, complianceRecords, auditLogs, documents,
  notifications, notificationPreferences, assetPhotos, InsertAssetPhoto,
  scheduledReports, InsertScheduledReport, assetTransfers, quickbooksConfig, InsertQuickBooksConfig,
  userPreferences, InsertUserPreferences, emailNotifications, InsertEmailNotification,
  workOrderTemplates, InsertWorkOrderTemplate, branchCodes, categoryCodes, subCategories,
  assetEditHistory, telemetryPoints, telemetryAggregates, reportSnapshots, predictiveScores,
  warehouseTransferRecommendations, vendorPerformanceMetrics, vendorRiskScores,
  procurementRecommendations, purchaseOrders, supplyChainRiskScores, supplyChainRiskEvents,
  fleetUnits, technicians, dispatchAssignments, executiveMetricsSnapshots, operationalKpiTrends,
  userSessions,
} from "./tables";
import { ENV } from "../_core/env";
import { logger } from "../_core/logger";
import { decryptOrgDataKey, encryptOrgDataKey, generateOrgDataKey } from "../_core/encryption";
import { getDb, getRootDb, normalizeOrganizationId } from "./core";

// ============= FINANCIAL TRANSACTIONS =============

export async function createFinancialTransaction(transaction: typeof financialTransactions.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(financialTransactions).values(transaction).returning({ id: financialTransactions.id });
  const insertId = result[0]?.id;
  if (!insertId) throw new Error("Failed to get insert ID");
  return await db.select().from(financialTransactions).where(eq(financialTransactions.id, Number(insertId))).limit(1).then(r => r[0]);
}

export async function getFinancialTransactions(filters?: { assetId?: number; workOrderId?: number; startDate?: Date; endDate?: Date }) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(financialTransactions);
  const conditions = [];
  
  if (filters?.assetId) conditions.push(eq(financialTransactions.assetId, filters.assetId));
  if (filters?.workOrderId) conditions.push(eq(financialTransactions.workOrderId, filters.workOrderId));
  if (filters?.startDate) conditions.push(gte(financialTransactions.transactionDate, filters.startDate));
  if (filters?.endDate) conditions.push(lte(financialTransactions.transactionDate, filters.endDate));
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  return await query.orderBy(desc(financialTransactions.transactionDate));
}

/** Precomputed financial totals (revenue vs expenses). No client-side reduce. */
export async function getFinancialSummary(filters?: { startDate?: Date; endDate?: Date }) {
  const db = await getDb();
  if (!db) return { totalRevenue: 0, totalExpenses: 0 };

  const conditions = [];
  if (filters?.startDate) conditions.push(gte(financialTransactions.transactionDate, filters.startDate));
  if (filters?.endDate) conditions.push(lte(financialTransactions.transactionDate, filters.endDate));

  const baseQuery = db
    .select({
      transactionType: financialTransactions.transactionType,
      total: sql<number>`COALESCE(SUM(CAST(${financialTransactions.amount} AS DECIMAL(15,2))), 0)`.as("total"),
    })
    .from(financialTransactions);

  const rows =
    conditions.length > 0
      ? await baseQuery.where(and(...conditions)).groupBy(financialTransactions.transactionType)
      : await baseQuery.groupBy(financialTransactions.transactionType);
  const revenueTypes = ["revenue"];
  const expenseTypes = ["acquisition", "maintenance", "repair", "disposal", "depreciation", "other"];
  let totalRevenue = 0;
  let totalExpenses = 0;
  for (const row of rows) {
    const t = Number(row.total);
    if (revenueTypes.includes(row.transactionType)) totalRevenue += t;
    if (expenseTypes.includes(row.transactionType)) totalExpenses += t;
  }
  return { totalRevenue, totalExpenses };
}

// ============= COMPLIANCE =============

export async function createComplianceRecord(record: typeof complianceRecords.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(complianceRecords).values(record).returning({ id: complianceRecords.id });
  const insertId = result[0]?.id;
  if (!insertId) throw new Error("Failed to get insert ID");
  return await db.select().from(complianceRecords).where(eq(complianceRecords.id, Number(insertId))).limit(1).then(r => r[0]);
}

export async function getAllComplianceRecords(filters?: { assetId?: number; status?: string; organizationId?: string | null }) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(complianceRecords);
  const conditions = [];
  
  if (filters?.assetId) conditions.push(eq(complianceRecords.assetId, filters.assetId));
  if (filters?.status) conditions.push(eq(complianceRecords.status, filters.status as any));
  if (filters?.organizationId != null && filters.organizationId !== "") {
    conditions.push(eq(complianceRecords.organizationId, normalizeOrganizationId(filters.organizationId)));
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  return await query.orderBy(desc(complianceRecords.createdAt));
}

export async function updateComplianceRecord(id: number, data: Partial<typeof complianceRecords.$inferInsert>) {
  const db = await getDb();
  if (!db) return null;
  await db.update(complianceRecords).set(data).where(eq(complianceRecords.id, id));
  return await db.select().from(complianceRecords).where(eq(complianceRecords.id, id)).limit(1).then(r => r[0] || null);
}

// ============= AUDIT LOGS =============

export async function createAuditLog(log: typeof auditLogs.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(auditLogs).values(log);
}

export async function getAuditLogs(filters?: { userId?: number; entityType?: string; entityId?: number; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(auditLogs);
  const conditions = [];
  
  if (filters?.userId) conditions.push(eq(auditLogs.userId, filters.userId));
  if (filters?.entityType) conditions.push(eq(auditLogs.entityType, filters.entityType));
  if (filters?.entityId) conditions.push(eq(auditLogs.entityId, filters.entityId));
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  const result = query.orderBy(desc(auditLogs.timestamp));
  
  if (filters?.limit) {
    return await result.limit(filters.limit);
  }
  
  return await result;
}

// ============= DOCUMENTS =============

export async function createDocument(doc: typeof documents.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const nextDoc = { ...doc };
  if (!nextDoc.organizationId) {
    if (nextDoc.entityType === "organization" && typeof nextDoc.entityId === "number" && nextDoc.entityId > 0) {
      nextDoc.organizationId = normalizeOrganizationId(nextDoc.entityId);
    }
  } else {
    nextDoc.organizationId = normalizeOrganizationId(nextDoc.organizationId);
  }
  const result = await db.insert(documents).values(nextDoc).returning({ id: documents.id });
  const insertId = result[0]?.id;
  if (!insertId) throw new Error("Failed to get insert ID");
  return await db.select().from(documents).where(eq(documents.id, Number(insertId))).limit(1).then(r => r[0]);
}

export async function getDocuments(entityType?: string, entityId?: number): Promise<(typeof documents.$inferSelect)[]>;
export async function getDocuments(filters: {
  entityType?: string;
  entityId?: number;
  organizationId?: string | number;
}): Promise<(typeof documents.$inferSelect)[]>;
export async function getDocuments(
  entityTypeOrFilters?: string | { entityType?: string; entityId?: number; organizationId?: string | number },
  entityId?: number
) {
  const db = await getDb();
  if (!db) return [];

  const isObjectFilters = typeof entityTypeOrFilters === "object" && entityTypeOrFilters !== null;
  const filters = isObjectFilters
    ? entityTypeOrFilters
    : { entityType: entityTypeOrFilters, entityId };
  const conditions = [];

  if (isObjectFilters) {
    if (filters.entityType) {
      conditions.push(eq(documents.entityType, filters.entityType));
    }
    if (typeof filters.entityId === "number") {
      conditions.push(eq(documents.entityId, filters.entityId));
    }
  } else if (filters.entityType && typeof filters.entityId === "number") {
    conditions.push(and(eq(documents.entityType, filters.entityType), eq(documents.entityId, filters.entityId)));
  }
  if (filters.organizationId !== undefined && filters.organizationId !== null) {
    conditions.push(eq(documents.organizationId, normalizeOrganizationId(filters.organizationId)));
  }

  if (conditions.length > 0) {
    return await db
      .select()
      .from(documents)
      .where(and(...conditions))
      .orderBy(desc(documents.createdAt));
  }

  return await db.select().from(documents).orderBy(desc(documents.createdAt));
}

export async function getActiveOrganizationEncryptionKey(
  organizationId: string | number,
  keyVersion?: number
) {
  const db = await getDb();
  if (!db) return null;
  const orgId = normalizeOrganizationId(organizationId);
  const query =
    Number.isInteger(keyVersion) && Number(keyVersion) > 0
      ? sql`
          select id, organization_id, key_version, encrypted_key, status, created_at
          from organization_encryption_keys
          where organization_id = ${orgId} and key_version = ${Number(keyVersion)}
          order by key_version desc
          limit 1
        `
      : sql`
          select id, organization_id, key_version, encrypted_key, status, created_at
          from organization_encryption_keys
          where organization_id = ${orgId} and status = 'active'
          order by key_version desc
          limit 1
        `;

  const rows = await db.execute(query);
  const row = ((rows as unknown[])?.[0] ?? null) as
    | {
        id: string;
        organization_id: string;
        key_version: number;
        encrypted_key: string;
        status: string;
        created_at: Date | string;
      }
    | null;
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    encryptedKey: row.encrypted_key,
    keyVersion: Number(row.key_version),
    status: row.status,
    createdAt: new Date(row.created_at),
  } as {
    id: string;
    organizationId: string;
    encryptedKey: string;
    keyVersion: number;
    status: string;
    createdAt: Date;
  };
}

export async function createOrganizationEncryptionKey(params: {
  organizationId: string | number;
  encryptedKey: string;
  keyVersion: number;
  status?: "active" | "retired";
}) {
  const db = await getDb();
  if (!db) return null;
  const orgId = normalizeOrganizationId(params.organizationId);
  const nextStatus = params.status ?? "active";

  if (nextStatus === "active") {
    await db.execute(sql`
      update organization_encryption_keys
      set status = 'retired', retired_at = now()
      where organization_id = ${orgId}
        and status = 'active'
    `);
  }

  await db.execute(sql`
    insert into organization_encryption_keys (
      organization_id,
      key_version,
      encrypted_key,
      status
    ) values (
      ${orgId},
      ${params.keyVersion},
      ${params.encryptedKey},
      ${nextStatus}
    )
  `);

  const rows = await db.execute(sql`
    select id, organization_id, key_version, encrypted_key, status, created_at
    from organization_encryption_keys
    where organization_id = ${orgId}
      and key_version = ${params.keyVersion}
    limit 1
  `);
  const row = ((rows as unknown[])?.[0] ?? null) as
    | {
        id: string;
        organization_id: string;
        key_version: number;
        encrypted_key: string;
        status: string;
        created_at: Date | string;
      }
    | null;
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    encryptedKey: row.encrypted_key,
    keyVersion: Number(row.key_version),
    status: row.status,
    createdAt: new Date(row.created_at),
  } as {
    id: string;
    organizationId: string;
    encryptedKey: string;
    keyVersion: number;
    status: string;
    createdAt: Date;
  };
}

export async function createEncryptedDocumentMetadata(params: {
  organizationId: string | number;
  uploadedBy: number;
  fileName: string;
  fileKey: string;
  fileUrl?: string;
  fileType: string;
  fileSize: number;
  encryption: {
    algorithm: string;
    iv: string;
    authTag: string;
    keyVersion: number;
    isEncrypted: true;
  };
}) {
  const organizationId = normalizeOrganizationId(params.organizationId);
  return createDocument({
    name: params.fileName,
    description: JSON.stringify({ originalFileName: params.fileName }),
    fileUrl: params.fileUrl ?? "",
    fileKey: params.fileKey,
    fileType: params.fileType,
    fileSize: params.fileSize,
    entityType: "organization",
    entityId: null,
    organizationId,
    encryptionAlgorithm: params.encryption.algorithm,
    encryptionKeyVersion: params.encryption.keyVersion,
    encryptionIv: params.encryption.iv,
    encryptionAuthTag: params.encryption.authTag,
    encryptedAt: new Date(),
    isEncrypted: true,
    uploadedBy: params.uploadedBy,
  });
}

export async function getDocumentById(
  documentId: number,
  options?: { organizationId?: string | number }
) {
  const db = await getDb();
  if (!db) return null;
  const conditions = [eq(documents.id, documentId)];
  if (options?.organizationId !== undefined && options.organizationId !== null) {
    conditions.push(eq(documents.organizationId, normalizeOrganizationId(options.organizationId)));
  }
  const rows = await db.select().from(documents).where(and(...conditions)).limit(1);
  return rows[0] ?? null;
}

export async function getDocumentByFileKey(
  fileKey: string,
  options?: { organizationId?: string | number }
) {
  const db = await getDb();
  if (!db) return null;
  const normalizedFileKey = fileKey.trim();
  if (!normalizedFileKey) return null;

  const conditions = [eq(documents.fileKey, normalizedFileKey)];
  if (options?.organizationId !== undefined && options.organizationId !== null) {
    conditions.push(eq(documents.organizationId, normalizeOrganizationId(options.organizationId)));
  }

  const rows = await db
    .select()
    .from(documents)
    .where(and(...conditions))
    .orderBy(desc(documents.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function createInitialOrganizationEncryptionKey(organizationId: string | number) {
  const existing = await getActiveOrganizationEncryptionKey(organizationId);
  if (existing) return existing;
  const encryptedKey = encryptOrgDataKey(generateOrgDataKey());
  return createOrganizationEncryptionKey({
    organizationId,
    encryptedKey,
    keyVersion: 1,
    status: "active",
  });
}

export async function rotateOrganizationEncryptionKey(organizationId: string | number) {
  const active = await getActiveOrganizationEncryptionKey(organizationId);
  const nextVersion = active ? Number(active.keyVersion) + 1 : 1;
  const encryptedKey = encryptOrgDataKey(generateOrgDataKey());
  const created = await createOrganizationEncryptionKey({
    organizationId,
    encryptedKey,
    keyVersion: nextVersion,
    status: "active",
  });
  return {
    retiredVersion: active ? Number(active.keyVersion) : null,
    activeKeyVersion: created ? Number(created.keyVersion) : null,
    organizationId: created?.organizationId ?? normalizeOrganizationId(organizationId),
  };
}

export async function getOrganizationEncryptionKeyMaterial(
  organizationId: string | number,
  keyVersion?: number
) {
  const keyRecord = await getActiveOrganizationEncryptionKey(organizationId, keyVersion);
  if (!keyRecord) return null;
  return {
    organizationId: keyRecord.organizationId,
    keyVersion: keyRecord.keyVersion,
    algorithm: "aes-256-gcm",
    dataKey: decryptOrgDataKey(keyRecord.encryptedKey),
  };
}

// ============= DASHBOARD STATISTICS =============

export async function getDashboardStats() {
  const db = await getDb();
  if (!db) return null;
  
  const [totalAssets] = await db.select({ count: sql<number>`count(*)` }).from(assets);
  const [operationalAssets] = await db.select({ count: sql<number>`count(*)` }).from(assets).where(eq(assets.status, 'operational'));
  const [maintenanceAssets] = await db.select({ count: sql<number>`count(*)` }).from(assets).where(eq(assets.status, 'maintenance'));
  const [pendingWorkOrders] = await db.select({ count: sql<number>`count(*)` }).from(workOrders).where(eq(workOrders.status, 'pending'));
  const [inProgressWorkOrders] = await db.select({ count: sql<number>`count(*)` }).from(workOrders).where(eq(workOrders.status, 'in_progress'));
  const [lowStockCount] = await db.select({ count: sql<number>`count(*)` }).from(inventoryItems)
    .where(sql`${inventoryItems.currentStock} <= ${inventoryItems.reorderPoint}`);
  
  return {
    totalAssets: Number(totalAssets?.count ?? 0),
    operationalAssets: Number(operationalAssets?.count ?? 0),
    maintenanceAssets: Number(maintenanceAssets?.count ?? 0),
    pendingWorkOrders: Number(pendingWorkOrders?.count ?? 0),
    inProgressWorkOrders: Number(inProgressWorkOrders?.count ?? 0),
    lowStockItems: Number(lowStockCount?.count ?? 0),
  };
}

// ============= NOTIFICATIONS =============

export async function createNotification(notification: typeof notifications.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(notifications).values(notification).returning({ id: notifications.id });
  return Number(result[0]?.id ?? 0);
}

export async function getUserNotifications(userId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function getUnreadNotificationCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(and(
      eq(notifications.userId, userId),
      eq(notifications.isRead, false)
    ));
  return result[0]?.count || 0;
}

export async function markNotificationAsRead(id: number) {
  const db = await getDb();
  if (!db) return null;
  return await db.update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(eq(notifications.id, id));
}

export async function markAllNotificationsAsRead(userId: number) {
  const db = await getDb();
  if (!db) return null;
  return await db.update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(
      eq(notifications.userId, userId),
      eq(notifications.isRead, false)
    ));
}

export async function deleteNotification(id: number) {
  const db = await getDb();
  if (!db) return null;
  return await db.delete(notifications).where(eq(notifications.id, id));
}

// ============= NOTIFICATION PREFERENCES =============

export async function getUserNotificationPreferences(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);
  return result[0] || null;
}

export async function upsertNotificationPreferences(userId: number, prefs: Partial<typeof notificationPreferences.$inferInsert>) {
  const db = await getDb();
  if (!db) return null;
  
  const existing = await getUserNotificationPreferences(userId);
  
  if (existing) {
    return await db.update(notificationPreferences)
      .set(prefs)
      .where(eq(notificationPreferences.userId, userId));
  } else {
    return await db.insert(notificationPreferences).values({
      userId,
      ...prefs,
    });
  }
}



// ===== Scheduled Reports =====
export async function createScheduledReport(data: InsertScheduledReport) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(scheduledReports).values(data).returning({ id: scheduledReports.id });
  return Number(result[0]?.id ?? 0);
}

export async function getScheduledReports() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(scheduledReports);
}

export async function getScheduledReportById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(scheduledReports).where(eq(scheduledReports.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateScheduledReport(id: number, data: Partial<InsertScheduledReport>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(scheduledReports).set(data).where(eq(scheduledReports.id, id));
}

export async function deleteScheduledReport(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(scheduledReports).where(eq(scheduledReports.id, id));
}

export async function getActiveScheduledReports() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(scheduledReports).where(eq(scheduledReports.isActive, true));
}

export async function getFinancialTransactionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(financialTransactions).where(eq(financialTransactions.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateFinancialTransaction(id: number, data: Partial<typeof financialTransactions.$inferInsert>) {
  const db = await getDb();
  if (!db) return null;
  await db.update(financialTransactions).set(data).where(eq(financialTransactions.id, id));
  return await getFinancialTransactionById(id);
}

// ============= QuickBooks Configuration =============
export async function getQuickBooksConfig() {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(quickbooksConfig).where(eq(quickbooksConfig.isActive, 1)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function saveQuickBooksConfig(config: InsertQuickBooksConfig) {
  const db = await getDb();
  if (!db) return undefined;
  
  // Deactivate all existing configs
  await db.update(quickbooksConfig).set({ isActive: 0 });
  
  // Insert new config
  const result = await db.insert(quickbooksConfig).values(config).returning({ id: quickbooksConfig.id });
  const insertId = result[0]?.id;
  if (!insertId) throw new Error("Failed to get insert ID");
  return await db.select().from(quickbooksConfig).where(eq(quickbooksConfig.id, Number(insertId))).limit(1).then(r => r[0]);
}

export async function updateQuickBooksTokens(id: number, accessToken: string, refreshToken: string, expiresAt: Date) {
  const db = await getDb();
  if (!db) return false;
  
  await db.update(quickbooksConfig)
    .set({ 
      accessToken, 
      refreshToken, 
      tokenExpiresAt: expiresAt 
    })
    .where(eq(quickbooksConfig.id, id));
  
  return true;
}

export async function updateQuickBooksLastSync(id: number) {
  const db = await getDb();
  if (!db) return false;
  
  await db.update(quickbooksConfig)
    .set({ lastSyncAt: new Date() })
    .where(eq(quickbooksConfig.id, id));
  
  return true;
}

// ============= AUDIT TRAIL =============

export async function logAuditEntry(entry: {
  userId: number;
  action: string;
  entityType?: string;
  entityId?: number;
  changes?: string;
}) {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(auditLogs).values({
    userId: entry.userId,
    action: entry.action,
    entityType: entry.entityType || null,
    entityId: entry.entityId || null,
    changes: entry.changes || null,
    ipAddress: null,
    userAgent: null,
  });
}

export async function getAssetAuditHistory(assetId: number) {
  return await getAuditLogs({ entityType: 'asset', entityId: assetId });
}