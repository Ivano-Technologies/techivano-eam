# Supabase / Multi-tenant Schema Audit

**Audit date:** 2026-03-16

---

## 1. Tenant model: organization-based

- **Canonical tables:** `organizations` (id uuid, name, slug, is_active), `organization_members` (organization_id, user_id, role, is_active). FK: `organization_members.organization_id` → `organizations.id` (cascade delete).
- **Legacy mapping:** `tenant_organization_map` (tenant_id int, organization_id uuid) maps integer tenant IDs to organization UUIDs for backfill and resolution.

---

## 2. Core tables and tenant isolation

| Table | Has organization_id? | Has tenantId (int)? | Notes |
|-------|----------------------|----------------------|--------|
| organizations | N/A (is root) | No | Canonical org table |
| organization_members | Yes (FK) | No | user_id = Supabase auth.users.id |
| users | No | No | Global user table; tenant via org membership / host |
| sites | Yes | No | organization_id indexed |
| assets | Yes | No | organization_id indexed |
| work_orders | Yes | No | organization_id indexed |
| maintenance_schedules | Yes | No | organization_id indexed |
| inventory_items | Yes | No | organization_id indexed |
| inventory_transactions | Yes | No | organization_id indexed |
| vendors | Yes | No | organization_id indexed |
| compliance_records | Yes | No | organization_id indexed |
| documents | Yes | No | organization_id indexed |
| asset_photos | Yes | No | organization_id indexed |
| inspections | Yes (notNull) | No | organization_id required |
| org_encryption_keys | Yes (notNull) | No | Per-org encryption |
| warehouse_transfer_recommendations | No | Yes (int) | Legacy tenantId |
| vendor_performance_metrics | No | Yes (int) | Legacy tenantId |
| vendor_risk_scores | No | Yes (int) | Legacy tenantId |
| procurement_recommendations | No | Yes (int) | Legacy tenantId |
| purchase_orders | No | Yes (int) | Legacy tenantId |
| supply_chain_risk_* | No | Yes (int) | Legacy tenantId |
| fleet_units, technicians, dispatch_assignments | No | Yes (int) | Legacy tenantId |
| executive_metrics_snapshots, operational_kpi_trends | No | Yes (int) | Legacy tenantId |
| telemetry_points, telemetry_aggregates, report_snapshots, predictive_scores | No | Yes (tenantId) | Legacy |
| inspection_templates | No | Yes (int) | Legacy tenantId |

**Summary:** Core EAM entities (sites, assets, work_orders, vendors, inspections, documents) use **organization_id (uuid)**. Several analytics/ML and legacy tables still use integer **tenantId**; resolution to org is via `tenant_organization_map` and app-layer context.

---

## 3. Row Level Security (RLS)

- **Drizzle schema:** This repo defines Drizzle schema only; RLS policies live in **Supabase** (SQL migrations or dashboard). The codebase uses **app-level tenant scoping** via `set_config('app.tenant_id', ...)` and context (organizationId/tenantId) in tRPC; DB queries filter by organization_id or tenantId in application code.
- **Recommendation:** Confirm in Supabase that RLS (or equivalent) is enabled on sensitive tables and that service role is used only where intended; application-layer checks are present in `server/_core/context.ts` and router procedures.

---

## 4. Foreign key integrity

- **organization_members.organization_id** → organizations.id (cascade).
- **tenant_organization_map.organization_id** → organizations.id (cascade).
- **users:** No organization_id column; membership in organization_members; Supabase Auth `user_id` in organization_members is auth.users.id (no FK in app schema across schema boundary).
- Other FKs (sites, assets, work_orders, etc.) reference each other as per schema; tenant scoping is via organization_id columns.

---

## 5. Migration consistency

- **Drizzle:** Migrations in `drizzle/` (or Supabase migrations) should match `drizzle/schema.ts`. Organizations and organization_members added in Supabase migration `20260309133000`; schema.ts reflects snake_case table names and columns.
- **Dual tenant identifiers:** Intentional: organization_id (uuid) is canonical; tenantId (int) remains for legacy tables and mapping table. No migration required for this audit; ensure any new tables use organization_id where appropriate.

---

## 6. Findings and recommendations

| Item | Status | Recommendation |
|------|--------|----------------|
| Organizations table | OK | — |
| Organization members | OK | — |
| Core EAM tables (assets, work_orders, etc.) | OK | All have organization_id |
| Legacy tenantId tables | Documented | Prefer organization_id for new tables; migrate when feasible |
| RLS | Not in repo | Verify in Supabase dashboard / SQL migrations |
| tenant_organization_map | OK | Used for resolving tenantId → organizationId in app layer |

**Verdict:** Multi-tenant design is **organization-based** with clear separation; legacy integer tenantId is isolated and mapped. No blocking schema changes required for stability; optional follow-up: add RLS documentation and gradual migration of legacy tables to organization_id.
