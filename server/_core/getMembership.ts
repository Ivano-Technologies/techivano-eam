/**
 * Resolve organization membership (role + permissions) for a user in an org.
 * Used to attach membership to tRPC context for RBAC. user_id is Supabase auth.users.id.
 */
import { and, eq } from "drizzle-orm";
import { organizationMembers } from "../../drizzle/schema";
import { getRootDb } from "../db";

export type Membership = {
  role: string;
  permissions: Record<string, boolean>;
};

export async function getMembership(
  supabaseUserId: string,
  organizationId: string
): Promise<Membership | null> {
  const db = getRootDb();
  if (!db) return null;

  const rows = await db
    .select({ role: organizationMembers.role, permissions: organizationMembers.permissions })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, supabaseUserId),
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.isActive, true)
      )
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const raw =
    row.permissions && typeof row.permissions === "object" && !Array.isArray(row.permissions)
      ? (row.permissions as Record<string, unknown>)
      : {};
  const permissions: Record<string, boolean> = {};
  for (const k of Object.keys(raw)) {
    permissions[k] = raw[k] === true;
  }

  return {
    role: row.role ?? "member",
    permissions,
  };
}
