# RLS: Server-Only Tables (No Policy by Design)

**Purpose:** Tables that have Row Level Security (RLS) **enabled** but **no RLS policies** are intentionally accessed only by the backend (service role or server-side code). Direct Postgres access with anon or key will return no rows for these tables.

## Rationale

- **Core tenant tables** (assets, work_orders, sites, vendors, documents, inspections, etc.) have org-scoped RLS policies and are listed in `supabase/migrations/20260309133000_canonical_organization_tenancy.sql` and `20260309160000_phase3_organization_id_not_null_and_rls.sql`.
- **Server-only tables** below are not exposed to client or anon/key; the API (tRPC) and workers use a service role or server-side DB connection that bypasses RLS, or they are internal (e.g. job runs, telemetry, audit logs). Adding a policy is unnecessary and would only duplicate server-side access control.

## Tables Considered Server-Only (RLS Enabled, No Policy)

| Table / area | Notes |
|--------------|--------|
| `asset_categories` / `assetCategories` | Reference data; access via tRPC with org context. No `organization_id`; if ever exposed, add org-scoped or deny policy. |
| `audit_logs` / `auditLogs` | Server-written; read only via admin/reports. |
| `background_job_runs` / `backgroundJobRuns` | Worker/internal only. |
| `telemetry_points` / `telemetry_points` | Ingest via tRPC `telemetry.ingest`; analytics/aggregates server-side. |
| `telemetry_aggregates` | Server-only rollups. |
| Other EAM internal tables | e.g. predictive scores, report snapshots, import history, notification preferences, etc. |

## When to Add a Policy

- If a table gains **direct client or anon/key access** (e.g. Supabase client from frontend), add an appropriate RLS policy (org-scoped if the table has `organization_id`, or `using (false)` to deny anon/key).
- After adding policies, run Supabase MCP `get_advisors(project_id, type: "security")` to confirm the count of “RLS enabled, no policy” matches this list.

## References

- [EXECUTIVE_RECOMMENDATIONS.md](./EXECUTIVE_RECOMMENDATIONS.md) — Security advisor findings.
- [PRD2_EXECUTION_AUDIT.md](./PRD2_EXECUTION_AUDIT.md) — P2 recommended step (RLS policies / document server-only).
