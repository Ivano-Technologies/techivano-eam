# Multi-Tenant Index Audit and Optimization — Report

**Date:** 2026-03-11  
**Migration:** `supabase/migrations/20260311_tenant_index_optimization.sql`

---

## 1. Tables analyzed (tenant-scoped)

All tables that participate in RLS with `organization_id` or `tenant_id` were discovered from the schema and existing migrations.

### organization_id (UUID)

| Table | Single-col index | Composite indexes added |
|-------|------------------|-------------------------|
| assets | ✓ | org+status, org+createdAt desc |
| workOrders | ✓ | org+status, org+assetId, org+createdAt desc |
| sites | ✓ | org+name |
| inventoryItems | ✓ | org+name, org+createdAt desc |
| maintenanceSchedules | ✓ | org+nextDue, org+createdAt desc |
| inventoryTransactions | ✓ | org+createdAt desc |
| documents | ✓ | org+createdAt desc |
| complianceRecords | ✓ | org+status, org+createdAt desc |
| vendors | ✓ | org+name, org+createdAt desc |
| assetPhotos | ✓ | org+createdAt desc |
| inspections | ✓ | org+createdAt desc |
| organization_encryption_keys | ✓ | (existing composites retained) |

### tenant_id / tenantId (int or UUID)

| Table | Single-col index | Composite indexes added |
|-------|------------------|-------------------------|
| warehouse_transfer_recommendations | ✓ | tenant_id+created_at desc |
| vendor_performance_metrics | ✓ | tenant_id+created_at desc |
| vendor_risk_scores | ✓ | tenant_id+created_at desc |
| procurement_recommendations | ✓ | tenant_id+created_at desc |
| supply_chain_risk_scores | ✓ | tenant_id+created_at desc |
| supply_chain_risk_events | ✓ | tenant_id+created_at desc |
| dispatch_assignments | ✓ | tenant_id+created_at desc, tenant_id+status |
| executive_metrics_snapshots | ✓ | tenant_id+snapshot_date desc |
| operational_kpi_trends | ✓ | tenant_id+metric_name+metric_date desc |
| telemetry_points | ✓ | tenantId+timestamp desc, tenantId+assetId+timestamp |
| telemetry_aggregates | ✓ | tenantId+hourBucket desc |
| report_snapshots | ✓ | tenantId+generated_at desc |
| predictive_scores | ✓ | tenantId+scored_at desc |
| inspection_templates | ✓ | tenantId+is_active, tenantId+createdAt desc |
| compliance_rules | ✓ | tenantId+createdAt desc |
| compliance_events | ✓ | tenantId+createdAt desc |
| platform_events | ✓ | tenant_id+created_at desc |
| purchase_orders | ✓ | tenant_id+status, tenant_id+created_at desc |
| fleet_units | ✓ | tenant_id+status |
| technicians | ✓ | tenant_id+created_at desc |

---

## 2. Indexes created

- **Single-column:** One index per (table, organization_id | tenant_id | tenantId) so every tenant-scoped table has the tenant column indexed. Created dynamically via `information_schema`; idempotent with `create index if not exists`.
- **Composite:** All composite indexes list the **tenant column first** (organization_id or tenant_id / "tenantId") so RLS filters use the index prefix. Second/third columns match common app patterns: status, created_at/createdAt, name, asset_id, etc.

No indexes were dropped in this migration (Phase 5: avoid redundant removal until verified with EXPLAIN).

---

## 3. Redundant indexes

- **Not removed.** Single-column tenant indexes are kept. A composite like `(organization_id, status)` can serve `WHERE organization_id = ?` as a prefix scan; dropping the single-column index would only be done after confirming with `EXPLAIN ANALYZE` that the composite is used for tenant-only queries and that the extra columns do not hurt. Recommendation: after deployment, run EXPLAIN on a few critical queries and only then consider dropping redundant single-column indexes if desired.

---

## 4. RLS and index order

- Every composite index has the **tenant column first**, so:
  - `WHERE organization_id = current_tenant_id()` (or equivalent) can use the index.
  - Additional predicates (status, created_at, etc.) use the following index columns.
- This matches Phase 4: “Ensure tenant column is always the first column in composite indexes.”

---

## 5. Migration file

- **Path:** `supabase/migrations/20260311_tenant_index_optimization.sql`
- **Contents:**
  - Phase 1–2: Dynamic loop over `information_schema` to ensure one single-column index per (table, organization_id | tenant_id | tenantId). Names kept under 63 chars.
  - Phase 3–4: Static list of (table, index_suffix, column_list) for composite indexes; each created with `create index if not exists`; exceptions caught so missing tables/columns do not fail the migration.
- **Idempotent:** Safe to run multiple times.

---

## 6. Query planner verification (Phase 7)

After applying the migration, run in Supabase SQL (replace `<org_uuid>` with a real organization_id):

```sql
-- Assets by tenant, recent first (dashboard)
explain (analyze, buffers)
select * from assets
where organization_id = '<org_uuid>'
order by "createdAt" desc
limit 50;
```

**Expected:** Index Scan (or Index Only Scan) on `idx_assets_org_created` (or equivalent); no Seq Scan on assets.

```sql
-- Work orders by tenant and status
explain (analyze, buffers)
select * from "workOrders"
where organization_id = '<org_uuid>' and status = 'pending'
order by "createdAt" desc
limit 50;
```

**Expected:** Index Scan using an index that starts with organization_id (e.g. idx_workOrders_org_status or idx_workOrders_org_created).

```sql
-- Telemetry by tenant and time
explain (analyze, buffers)
select * from telemetry_points
where "tenantId" = 1
order by timestamp desc
limit 100;
```

**Expected:** Index Scan on an index starting with "tenantId" (e.g. idx_telemetry_points_tenant_ts).

---

## 7. Sample queries to validate (Phase 8)

- **Assets dashboard:** List assets for org, filter by status, order by created_at desc → use org+status or org+created.
- **Recent work orders:** List work orders for org, order by created_at desc → use org+created.
- **Inventory lookups:** List inventory items for org, order by name or currentStock → use org+name or similar.
- **Site searches:** List sites for org, order by name → use org+name.
- **Telemetry:** Recent points for tenant, optionally by asset → use tenantId+timestamp or tenantId+assetId+timestamp.

Run `EXPLAIN (ANALYZE, BUFFERS) <query>` for each and confirm Index Scan (not Seq Scan) and low cost.

---

## 8. Performance targets (Phase 9)

- **Target:** Typical dashboard queries (assets, work orders, inventory, sites) for a tenant with **50k–100k** rows should execute in **~5–20 ms** when using the new indexes and RLS.
- **How to check:** Run the same queries with `EXPLAIN (ANALYZE, BUFFERS)` and inspect execution time and “Planning Time” + “Execution Time” in the output. Tune if any critical query still does a Seq Scan or exceeds the target.

---

## 9. Summary

| Item | Status |
|------|--------|
| Tenant-scoped tables discovered (org_id / tenant_id) | Done |
| Single-column tenant index per table | Done (idempotent) |
| Composite indexes (tenant column first) for common patterns | Done |
| No redundant index removal in this migration | Done |
| Migration file created and idempotent | Done |
| Query planner verification steps documented | Done |
| Sample queries and performance targets documented | Done |

**Completion:** The schema is audited and optimized for multi-tenant RLS. Apply `20260311_tenant_index_optimization.sql`, then run the EXPLAIN checks above to confirm index usage and hit the 5–20 ms target for large tenants.
