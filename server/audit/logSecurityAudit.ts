/**
 * Security audit logging: tamper-resistant, server-only. Tamper-evident chain via hash column.
 * Use getRootDb() so entries can be written outside tenant context (e.g. login).
 */
import { createHash } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { getRootDb } from "../db";
import { securityAuditLog } from "../../drizzle/schema";
import { logger } from "../_core/logger";

export type SecurityAuditContext = {
  user?: { supabaseUserId?: string | null } | null;
  organizationId?: string | null;
  req?: { ip?: string; headers?: Record<string, string | string[] | undefined> };
};

export type SecurityAuditEntry = {
  action: string;
  entity?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
};

const GENESIS_HASH = "";

function chainHash(prevHash: string, entry: Record<string, unknown>): string {
  const payload = prevHash + JSON.stringify(entry);
  return createHash("sha256").update(payload).digest("hex");
}

export async function logSecurityAudit(
  ctx: SecurityAuditContext,
  entry: SecurityAuditEntry
): Promise<void> {
  try {
    const db = getRootDb();
    if (!db) return;

    const userId = ctx.user?.supabaseUserId ?? null;
    const orgId = ctx.organizationId ?? null;
    const ip = typeof ctx.req?.ip === "string" ? ctx.req.ip : null;
    const rawUa = ctx.req?.headers?.["user-agent"];
    const userAgent = typeof rawUa === "string" ? rawUa : Array.isArray(rawUa) ? rawUa[0] ?? null : null;

    const prevRow = await db
      .select({ hash: securityAuditLog.hash })
      .from(securityAuditLog)
      .orderBy(desc(securityAuditLog.createdAt))
      .limit(1);
    const prevHash = prevRow[0]?.hash ?? GENESIS_HASH;

    const [inserted] = await db
      .insert(securityAuditLog)
      .values({
        userId: userId ?? undefined,
        orgId: orgId ?? undefined,
        action: entry.action,
        entity: entry.entity ?? null,
        entityId: entry.entityId ?? null,
        metadata: entry.metadata ?? {},
        ip: ip ?? null,
        userAgent: userAgent ?? null,
      })
      .returning({ id: securityAuditLog.id, createdAt: securityAuditLog.createdAt });

    if (inserted) {
      const entryForHash = {
        id: inserted.id,
        userId,
        orgId,
        action: entry.action,
        entity: entry.entity ?? null,
        entityId: entry.entityId ?? null,
        metadata: entry.metadata ?? {},
        ip,
        userAgent,
        createdAt: inserted.createdAt instanceof Date ? inserted.createdAt.toISOString() : inserted.createdAt,
      };
      const hash = chainHash(prevHash, entryForHash);
      await db.update(securityAuditLog).set({ hash }).where(eq(securityAuditLog.id, inserted.id));
    }
  } catch (err) {
    logger.warn("Security audit log write failed (non-fatal)", { err, action: entry.action });
  }
}
