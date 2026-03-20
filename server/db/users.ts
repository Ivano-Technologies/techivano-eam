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

// ============= USER MANAGEMENT =============

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = getRootDb();
  if (!db) {
    logger.warn("Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }
    if (user.siteId !== undefined) {
      values.siteId = user.siteId;
      updateSet.siteId = user.siteId;
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    logger.error("Failed to upsert user", {
      errorType: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = getRootDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(users).orderBy(desc(users.createdAt));
}

/** Dev-only: get an admin user for bypass login. Prefer DEV_ADMIN_EMAIL if set, else first admin. */
export async function getDevAdminUser(devAdminEmail?: string | null) {
  const database = getRootDb();
  if (!database) return null;
  if (devAdminEmail?.trim()) {
    const byEmail = await database.select().from(users).where(eq(users.email, devAdminEmail.trim())).limit(1);
    if (byEmail.length > 0) return byEmail[0];
  }
  const admins = await database.select().from(users).where(eq(users.role, "admin")).limit(1);
  return admins.length > 0 ? admins[0] : null;
}

/** Get user by id using root DB (no tenant context). Used for dev bypass auth. */
export async function getUserByIdRoot(id: number) {
  const database = getRootDb();
  if (!database) return null;
  const result = await database.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateUserRole(userId: number, role: "admin" | "manager" | "technician" | "user") {
  const db = await getDb();
  if (!db) return null;
  await db.update(users).set({ role }).where(eq(users.id, userId));
  return await db.select().from(users).where(eq(users.id, userId)).limit(1).then(r => r[0]);
}

// ===== Additional User Management Functions =====
export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/** Get user by id from root DB (no tenant context). Use for auth flows like password reset. */
export async function getRootUserById(id: number) {
  const database = getRootDb();
  if (!database) return undefined;
  const result = await database.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUser(id: number, data: Partial<InsertUser>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(users).set(data).where(eq(users.id, id));
  return { success: true };
}

export async function deleteUser(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(users).where(eq(users.id, id));
  return { success: true };
}

// ============= User Preferences =============
export async function getUserPreferences(userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
  if (result.length > 0) {
    return result[0];
  }
  // Return default preferences with wide sidebar width (360px)
  return {
    userId,
    sidebarWidth: 360,
    sidebarCollapsed: 0,
    dashboardWidgets: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;
}

export async function upsertUserPreferences(prefs: InsertUserPreferences) {
  const db = await getDb();
  if (!db) return null;
  
  const existing = await getUserPreferences(prefs.userId);
  
  if (existing) {
    await db.update(userPreferences)
      .set({ ...prefs, updatedAt: new Date() })
      .where(eq(userPreferences.userId, prefs.userId));
    return await getUserPreferences(prefs.userId);
  } else {
    const result = await db.insert(userPreferences).values(prefs).returning({ id: userPreferences.id });
    const insertId = result[0]?.id;
    if (!insertId) throw new Error("Failed to get insert ID");
    return await db.select().from(userPreferences).where(eq(userPreferences.id, Number(insertId))).limit(1).then(r => r[0]);
  }
}


// ============= Email Notifications =============
export async function createEmailNotification(notification: InsertEmailNotification) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(emailNotifications).values(notification).returning({ id: emailNotifications.id });
  const insertId = result[0]?.id;
  if (!insertId) throw new Error("Failed to get insert ID");
  return await db.select().from(emailNotifications).where(eq(emailNotifications.id, Number(insertId))).limit(1).then(r => r[0]);
}

export async function getEmailNotificationHistory(limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(emailNotifications).orderBy(desc(emailNotifications.sentAt)).limit(limit);
}

export async function getEmailNotificationById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(emailNotifications).where(eq(emailNotifications.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getUserByEmail(email: string) {
  const database = getRootDb();
  if (!database) return null;

  const result = await database
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

/** Get app user by Supabase Auth user id (auth.users.id). */
export async function getUserBySupabaseUserId(supabaseUserId: string) {
  const database = getRootDb();
  if (!database) return undefined;
  const result = await database
    .select()
    .from(users)
    .where(eq(users.supabaseUserId, supabaseUserId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/** Create a user session row (device/session tracking). Returns session id or null. */
export async function createUserSession(params: {
  userId: string;
  userAgent?: string | null;
  ip?: string | null;
}): Promise<string | null> {
  const database = getRootDb();
  if (!database) return null;
  const [row] = await database
    .insert(userSessions)
    .values({
      userId: params.userId,
      userAgent: params.userAgent ?? null,
      ip: params.ip ?? null,
    })
    .returning({ id: userSessions.id });
  return row?.id ?? null;
}

/** Update last_seen_at for a session. No-op if session not found. */
export async function touchSessionLastSeen(sessionId: string): Promise<void> {
  const database = getRootDb();
  if (!database) return;
  await database
    .update(userSessions)
    .set({ lastSeenAt: new Date() })
    .where(eq(userSessions.id, sessionId));
}

/** Get session by id (for revoked check). */
export async function getSessionById(sessionId: string) {
  const database = getRootDb();
  if (!database) return null;
  const [row] = await database
    .select()
    .from(userSessions)
    .where(eq(userSessions.id, sessionId))
    .limit(1);
  return row ?? null;
}

/** List sessions for a user (Supabase user id). */
export async function listUserSessions(userId: string) {
  const database = getRootDb();
  if (!database) return [];
  return database
    .select()
    .from(userSessions)
    .where(eq(userSessions.userId, userId))
    .orderBy(desc(userSessions.lastSeenAt));
}

/** Mark session as revoked. */
export async function revokeSessionById(sessionId: string): Promise<void> {
  const database = getRootDb();
  if (!database) return;
  await database
    .update(userSessions)
    .set({ revoked: true })
    .where(eq(userSessions.id, sessionId));
}

/** Set supabase_user_id on an existing user (lazy migration / first Supabase login). */
export async function setUserSupabaseId(userId: number, supabaseUserId: string): Promise<void> {
  const database = getRootDb();
  if (!database) return;
  await database
    .update(users)
    .set({ supabaseUserId, lastSignedIn: new Date() })
    .where(eq(users.id, userId));
}

/** Mark user as MFA enrolled and set last verified; set mfa_enforced for global owners. */
export async function setUserMfaEnrolled(userId: number, isGlobalOwner: boolean): Promise<void> {
  const database = getRootDb();
  if (!database) return;
  const now = new Date();
  await database
    .update(users)
    .set({
      mfaEnabled: true,
      mfaLastVerifiedAt: now,
      ...(isGlobalOwner ? { mfaEnforced: true } : {}),
    })
    .where(eq(users.id, userId));
}

/** Refresh MFA last verified timestamp (e.g. after TOTP challenge at login or step-up). */
export async function setUserMfaVerifiedAt(userId: number): Promise<void> {
  const database = getRootDb();
  if (!database) return;
  await database
    .update(users)
    .set({ mfaLastVerifiedAt: new Date() })
    .where(eq(users.id, userId));
}

/**
 * Create an app user from a valid Supabase JWT payload when no user exists (e.g. test account or first login).
 * Uses sub as openId and supabase_user_id; status approved so they can log in immediately.
 */
export async function provisionUserFromSupabase(payload: { sub: string; email?: string }): Promise<typeof users.$inferSelect | null> {
  const database = getRootDb();
  if (!database) return null;
  const openId = payload.sub;
  const email = payload.email ?? "";
  const name = (email && email.includes("@")) ? email.split("@")[0] : "User";
  try {
    const result = await database
      .insert(users)
      .values({
        openId,
        email: email || null,
        name: name || null,
        supabaseUserId: payload.sub,
        status: "approved",
        role: "user",
        loginMethod: "supabase",
      } as any)
      .onConflictDoUpdate({
        target: users.openId,
        set: { supabaseUserId: payload.sub, lastSignedIn: new Date(), email: email || undefined, name: name || undefined },
      })
      .returning();
    return result[0] ?? null;
  } catch {
    const existing = await getUserBySupabaseUserId(payload.sub);
    return existing ?? null;
  }
}

/** Get Supabase user id for an app user (for cache invalidation). */
export async function getSupabaseUserIdByAppId(appUserId: number): Promise<string | null> {
  const database = getRootDb();
  if (!database) return null;
  const result = await database
    .select({ supabaseUserId: users.supabaseUserId })
    .from(users)
    .where(eq(users.id, appUserId))
    .limit(1);
  const sid = result[0]?.supabaseUserId;
  return typeof sid === "string" ? sid : null;
}

// ============= USER VERIFICATION =============

export async function getPendingUsers() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(users)
    .where(sql`status IN ('pending', 'approved', 'rejected')`)
    .orderBy(desc(users.createdAt));
}

export async function approveUser(userId: number, approvedBy: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(users)
    .set({
      status: 'approved',
      approvedBy,
      approvedAt: new Date(),
    })
    .where(eq(users.id, userId));
  
  return { success: true };
}

export async function rejectUser(userId: number, reason?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(users)
    .set({
      status: 'rejected',
      rejectionReason: reason || 'Registration not approved',
    })
    .where(eq(users.id, userId));
  
  return { success: true };
}

export async function bulkApproveUsers(userIds: number[], approvedBy: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  for (const userId of userIds) {
    await db.update(users)
      .set({
        status: 'approved',
        approvedBy,
        approvedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }
  
  return { success: true, count: userIds.length };
}

export async function bulkRejectUsers(userIds: number[], reason?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  for (const userId of userIds) {
    await db.update(users)
      .set({
        status: 'rejected',
        rejectionReason: reason || 'Registration not approved',
      })
      .where(eq(users.id, userId));
  }
  
  return { success: true, count: userIds.length };
}