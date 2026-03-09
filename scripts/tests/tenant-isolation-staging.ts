import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config();

type CheckStatus = "PASS" | "FAIL" | "SKIP";

type CheckResult = {
  check: string;
  status: CheckStatus;
  details: string;
};

type OrgPair = {
  orgA: string;
  userA: string;
  orgB: string;
  userB: string;
};

const sqlReferencePath = path.resolve(
  process.cwd(),
  "docs/scripts/tests/tenant-isolation-staging.sql",
);

function printHeader() {
  console.log("Tenant Isolation Verification (Staging)");
  console.log(`SQL reference: ${sqlReferencePath}`);
  if (fs.existsSync(sqlReferencePath)) {
    console.log("Reference SQL file found.");
  } else {
    console.log("Reference SQL file missing (runner still executes checks).");
  }
  console.log("");
}

function formatRow(result: CheckResult): string {
  return `${result.status.padEnd(5)} | ${result.check.padEnd(46)} | ${result.details}`;
}

async function countOrgRows(
  tx: any,
  userId: string,
  tableName: "assets" | "documents",
  orgId: string,
  encryptedOnly = false,
): Promise<number> {
  await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`;

  if (tableName === "assets") {
    const rows = await tx<{ count: number }[]>`
      select count(*)::int as count
      from public.assets
      where organization_id = ${orgId}::uuid
    `;
    return rows[0]?.count ?? 0;
  }

  const rows = await tx<{ count: number }[]>`
    select count(*)::int as count
    from public.documents
    where organization_id = ${orgId}::uuid
      and (${encryptedOnly} = false or coalesce(is_encrypted, false) = true)
  `;
  return rows[0]?.count ?? 0;
}

async function resolveOrgPair(sql: any): Promise<OrgPair | null> {
  const rows = await sql<OrgPair[]>`
    with members as (
      select distinct organization_id::text as org_id, user_id::text as user_id
      from public.organization_members
      where is_active = true
        and organization_id is not null
        and user_id is not null
    )
    select
      a.org_id as "orgA",
      a.user_id as "userA",
      b.org_id as "orgB",
      b.user_id as "userB"
    from members a
    join members b on a.org_id <> b.org_id
    limit 1
  `;

  return rows[0] ?? null;
}

async function checkRlsVisibility(sql: any): Promise<CheckResult> {
  const rows = await sql<{ table_name: string; rls_enabled: boolean; has_policy: boolean }[]>`
    with required_tables as (
      select unnest(array['organizations', 'organization_members', 'assets', 'documents']) as table_name
    ),
    rls_flags as (
      select c.relname as table_name, c.relrowsecurity as rls_enabled
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname in (select table_name from required_tables)
    ),
    policy_presence as (
      select tablename as table_name, count(*) > 0 as has_policy
      from pg_policies
      where schemaname = 'public'
        and tablename in (select table_name from required_tables)
      group by tablename
    )
    select
      t.table_name,
      coalesce(r.rls_enabled, false) as rls_enabled,
      coalesce(p.has_policy, false) as has_policy
    from required_tables t
    left join rls_flags r on r.table_name = t.table_name
    left join policy_presence p on p.table_name = t.table_name
    order by t.table_name
  `;

  const failing = rows.filter((r) => !r.rls_enabled || !r.has_policy);
  if (failing.length > 0) {
    const detail = failing
      .map((r) => `${r.table_name}(rls=${r.rls_enabled},policy=${r.has_policy})`)
      .join(", ");
    return {
      check: "Org RLS policy visibility checks",
      status: "FAIL",
      details: `Missing RLS/policy on: ${detail}`,
    };
  }

  return {
    check: "Org RLS policy visibility checks",
    status: "PASS",
    details: `Verified ${rows.length} public tables with RLS + policy`,
  };
}

async function checkCrossOrgAssetsVisibility(
  sql: any,
  pair: OrgPair | null,
): Promise<CheckResult> {
  if (!pair) {
    return {
      check: "User from Org A cannot read Org B rows (assets)",
      status: "SKIP",
      details: "No active cross-org member pair found; seed staging fixture and rerun",
    };
  }

  const crossOrgVisible = await sql.begin(async (tx: any) => {
    await tx`set transaction read only`;
    await tx`select set_config('request.jwt.claim.role', 'authenticated', true)`;
    const orgBAssetRows = await countOrgRows(tx, pair.userB, "assets", pair.orgB);
    const crossOrgVisible = await countOrgRows(tx, pair.userA, "assets", pair.orgB);
    return { orgBAssetRows, crossOrgVisible };
  });

  if (crossOrgVisible.orgBAssetRows === 0) {
    return {
      check: "User from Org A cannot read Org B rows (assets)",
      status: "SKIP",
      details: `No Org B assets found for orgB=${pair.orgB}; seed fixture row and rerun`,
    };
  }

  return {
    check: "User from Org A cannot read Org B rows (assets)",
    status: crossOrgVisible.crossOrgVisible === 0 ? "PASS" : "FAIL",
    details:
      crossOrgVisible.crossOrgVisible === 0
        ? `Org A user cannot see Org B assets (orgB=${pair.orgB})`
        : `Org A user can see ${crossOrgVisible.crossOrgVisible} Org B asset row(s)`,
  };
}

async function checkEncryptedDocumentIsolation(
  sql: any,
  pair: OrgPair | null,
): Promise<CheckResult> {
  if (!pair) {
    return {
      check: "Encrypted doc retrieval requires matching organization_id",
      status: "SKIP",
      details: "No active cross-org member pair found; seed staging fixture and rerun",
    };
  }

  const crossEncryptedVisible = await sql.begin(async (tx: any) => {
    await tx`set transaction read only`;
    await tx`select set_config('request.jwt.claim.role', 'authenticated', true)`;
    const orgBEncryptedDocRows = await countOrgRows(
      tx,
      pair.userB,
      "documents",
      pair.orgB,
      true,
    );
    const crossEncryptedVisible = await countOrgRows(
      tx,
      pair.userA,
      "documents",
      pair.orgB,
      true,
    );
    return { orgBEncryptedDocRows, crossEncryptedVisible };
  });

  if (crossEncryptedVisible.orgBEncryptedDocRows === 0) {
    return {
      check: "Encrypted doc retrieval requires matching organization_id",
      status: "SKIP",
      details: `No encrypted Org B docs found for orgB=${pair.orgB}; seed fixture row and rerun`,
    };
  }

  return {
    check: "Encrypted doc retrieval requires matching organization_id",
    status: crossEncryptedVisible.crossEncryptedVisible === 0 ? "PASS" : "FAIL",
    details:
      crossEncryptedVisible.crossEncryptedVisible === 0
        ? `Org A user cannot see Org B encrypted docs (orgB=${pair.orgB})`
        : `Org A user can see ${crossEncryptedVisible.crossEncryptedVisible} Org B encrypted doc(s)`,
  };
}

async function main() {
  printHeader();

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required.");
    process.exitCode = 1;
    return;
  }

  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    idle_timeout: 5,
  });

  try {
    const pair = await resolveOrgPair(sql);
    const results: CheckResult[] = [];
    results.push(await checkRlsVisibility(sql));
    results.push(await checkCrossOrgAssetsVisibility(sql, pair));
    results.push(await checkEncryptedDocumentIsolation(sql, pair));

    console.log("Status | Check                                          | Details");
    console.log("------ | ---------------------------------------------- | -------");
    for (const result of results) {
      console.log(formatRow(result));
    }

    const failed = results.filter((r) => r.status === "FAIL");
    const skipped = results.filter((r) => r.status === "SKIP");
    console.log("");
    console.log(`Summary: ${results.length - failed.length} non-failing, ${failed.length} failing, ${skipped.length} skipped`);

    if (failed.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error("Tenant isolation verification failed to execute.");
  console.error(error);
  process.exitCode = 1;
});
