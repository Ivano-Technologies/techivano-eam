/**
 * Seeds a test organization and links the E2E test user(s) to it for multi-tenant and RBAC E2E.
 * Run after seed-test-user.ts. Creates one org and organization_members row(s).
 * Requires DATABASE_URL (app DB) and Supabase for auth user lookup.
 *
 *   pnpm tsx scripts/seed-org-data.ts
 *
 * Env:
 *   E2E_AUTH_EMAIL (required) — primary E2E user email
 *   E2E_USER_ROLE (optional) — role for primary user: owner | admin | manager | member | viewer (default: member)
 *   E2E_ADMIN_EMAIL (optional) — second user email; will be added to same org with role admin (for RBAC tests)
 *   E2E_MANAGER_EMAIL (optional) — third user email; will be added to same org with role manager (for manager-boundary test)
 *   E2E_TEST_ORG_SLUG (optional, default: e2e-test-org)
 */
import "dotenv/config";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import { createClient } from "@supabase/supabase-js";
import { getRootDb } from "../server/db";
import { organizations, organizationMembers } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const VALID_ROLES = ["owner", "admin", "manager", "member", "viewer"] as const;
type OrgRole = (typeof VALID_ROLES)[number];

const E2E_ORG_NAME = "E2E Test Org";
const E2E_ORG_SLUG = process.env.E2E_TEST_ORG_SLUG ?? "e2e-test-org";
const email = process.env.E2E_AUTH_EMAIL!;
const roleRaw = process.env.E2E_USER_ROLE ?? "member";
const primaryRole: OrgRole = VALID_ROLES.includes(roleRaw as OrgRole) ? (roleRaw as OrgRole) : "member";
const adminEmail = process.env.E2E_ADMIN_EMAIL;
const managerEmail = process.env.E2E_MANAGER_EMAIL;

async function run() {
  if (!email) {
    console.error("Missing E2E_AUTH_EMAIL");
    process.exit(1);
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: listData } = await supabase.auth.admin.listUsers();
  const user = listData.users.find((u) => u.email === email);
  if (!user) {
    console.error("E2E user not found. Run seed-test-user.ts first.");
    process.exit(1);
  }

  const db = getRootDb();
  if (!db) {
    console.error("Database not available. Set DATABASE_URL.");
    process.exit(1);
  }

  const existing = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, E2E_ORG_SLUG))
    .limit(1);

  let orgId: string;
  if (existing.length > 0) {
    orgId = existing[0].id;
  } else {
    const [inserted] = await db
      .insert(organizations)
      .values({
        name: E2E_ORG_NAME,
        slug: E2E_ORG_SLUG,
      })
      .returning({ id: organizations.id });
    if (!inserted?.id) {
      console.error("Failed to create organization");
      process.exit(1);
    }
    orgId = inserted.id;
  }

  if (!orgId) {
    console.error("❌ No orgId generated");
    process.exit(1);
  }

  const memberForUser = await db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, user.id))
    .limit(1);

  if (memberForUser.some((m) => m.organizationId === orgId)) {
    process.stdout.write(JSON.stringify({ orgId }) + "\n");
    return;
  }

  await db.insert(organizationMembers).values({
    organizationId: orgId,
    userId: user.id,
    role: primaryRole,
    permissions: {},
    isActive: true,
  });

  console.log(`✓ Org + membership seeded (${email} as ${primaryRole})`);

  if (adminEmail && adminEmail !== email) {
    const adminUser = listData.users.find((u) => u.email === adminEmail);
    if (adminUser) {
      const adminMember = await db
        .select()
        .from(organizationMembers)
        .where(eq(organizationMembers.userId, adminUser.id))
        .limit(1);
      const alreadyInOrg = adminMember.some((m) => m.organizationId === orgId);
      if (!alreadyInOrg) {
        await db.insert(organizationMembers).values({
          organizationId: orgId,
          userId: adminUser.id,
          role: "admin",
          permissions: {},
          isActive: true,
        });
        console.log(`✓ Admin user ${adminEmail} added to org as admin`);
      }
    } else {
      console.warn(`E2E_ADMIN_EMAIL ${adminEmail} not found in Supabase Auth; run seed for that user first.`);
    }
  }

  if (managerEmail && managerEmail !== email && managerEmail !== adminEmail) {
    const managerUser = listData.users.find((u) => u.email === managerEmail);
    if (managerUser) {
      const managerMember = await db
        .select()
        .from(organizationMembers)
        .where(eq(organizationMembers.userId, managerUser.id))
        .limit(1);
      const alreadyInOrg = managerMember.some((m) => m.organizationId === orgId);
      if (!alreadyInOrg) {
        await db.insert(organizationMembers).values({
          organizationId: orgId,
          userId: managerUser.id,
          role: "manager",
          permissions: {},
          isActive: true,
        });
        console.log(`✓ Manager user ${managerEmail} added to org as manager`);
      }
    } else {
      console.warn(`E2E_MANAGER_EMAIL ${managerEmail} not found in Supabase Auth; run seed for that user first.`);
    }
  }

  process.stdout.write(JSON.stringify({ orgId }) + "\n");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
