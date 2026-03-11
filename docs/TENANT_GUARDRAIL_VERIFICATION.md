# Tenant Guardrail Layer — Verification Report

**Objective:** Hard tenant isolation at the database level so a query cannot return rows from another tenant even if application code omits a `WHERE tenant_id` / `organization_id` clause.

---

## 1. Migration created

| File | Purpose |
|------|---------|
| `supabase/migrations/20260311130000_tenant_context_guardrail.sql` | Defines `current_tenant_id()` (reads `app.tenant_id` session variable) and `assert_tenant_set()` (raises if not set). |
| `supabase/migrations/20260311140000_rls_use_current_tenant_id.sql` | Updates RLS policies to use `current_tenant_id()` with fallback to `auth.uid()` when not set. Drops existing `_org_isolation` / `_tenant_isolation` and creates `_tenant_guardrail` policies. |

**Apply:** Run in order (e.g. `supabase db push` or your migration process).

---

## 2. RLS policies updated

Policies now use:

- **When `app.tenant_id` is set (server request):** `organization_id = current_tenant_id()` (or `tenant_id = current_tenant_id()` for tenant_id tables).
- **When `app.tenant_id` is not set (e.g. Supabase client with JWT):** Fallback to `organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())`.

Tables covered (where they exist and have the column):

- **organization_id:** assets, work_orders, inspections, documents, asset_photos, maintenance_schedules, inventory_items, inventory_transactions, vendors, compliance_records, sites, workOrders, maintenanceSchedules, inventoryItems, inventoryTransactions, complianceRecords, assetPhotos, organization_encryption_keys, platform_events, warehouse_transfer_recommendations, vendor_performance, integration_connectors, telemetry_anomaly_events.
- **tenant_id (uuid):** platform_events, warehouse_transfer_recommendations, vendor_performance, integration_connectors, telemetry_anomaly_events.
- **organizations:** id = current_tenant_id() or auth.uid() via organization_members.

---

## 3. Server context updated

| Component | Change |
|-----------|--------|
| **server/_core/tenantResolver.ts** | `getOrganizationIdForGuardrail(ctx)`, `getTenantIdForGuardrail(ctx)` — resolve from tRPC context. |
| **server/_core/tenantContext.ts** | AsyncLocalStorage for request-scoped tenant; `runWithTenantContext()`, `getTenantOrganizationId()`, `getTenantId()`, `setTenantContextOnConnection(exec, organizationId)`. |
| **server/_core/trpc.ts** | All procedures run inside `runWithTenantContext({ organizationId, tenantId }, () => next({ ctx }))` so tenant is available for any code that injects into Postgres. |

---

## 4. Session injection (SET LOCAL)

The app currently uses **Drizzle with mysql2** in `server/db.ts`. To enforce the guardrail on **Supabase Postgres**:

1. Use a **Postgres** driver and connection pool when `DATABASE_URL` points to Supabase (e.g. `postgres://...`).
2. At the start of each request, get a connection from the pool and run:
   ```ts
   await setTenantContextOnConnection(connection.query.bind(connection), ctx.organizationId);
   ```
   (or `SELECT set_config('app.tenant_id', $1, true)` with the organization UUID).
3. Use that connection for all DB work in that request so `current_tenant_id()` in RLS sees the set value.

**Compatibility:** `SET LOCAL` / `set_config(..., true)` is connection-scoped and works with Supabase connection pooling.

---

## 5. Test results

| Test | Result |
|------|--------|
| **tenantResolver** returns organizationId/tenantId from context | Pass |
| **tenantContext** runWithTenantContext sets storage; getTenantOrganizationId reads it | Pass |
| **setTenantContextOnConnection** calls exec with set_config SQL and params | Pass |
| **Cross-tenant** inner context does not leak to outer | Pass |

Run: `pnpm test server/test/tenantIsolation.test.ts`

---

## 6. Verification query (manual)

On a Supabase Postgres database with the migrations applied:

**Without tenant context (expect 0 rows):**

```sql
-- Do not set app.tenant_id; current_tenant_id() returns null.
SELECT * FROM assets;
-- RLS: organization_id = null matches no rows → 0 rows.
```

**With tenant context (expect only that tenant’s rows):**

```sql
SELECT set_config('app.tenant_id', '00000000-0000-4000-8000-000000000001', true);
SELECT * FROM assets;
-- RLS: organization_id = current_tenant_id() → only that org’s rows.
```

**Assert tenant set (expect error if not set):**

```sql
SELECT assert_tenant_set();
-- If app.tenant_id not set: ERROR: Tenant context not set
```

---

## 7. Confirmation

| Requirement | Status |
|-------------|--------|
| Tenant context function (`current_tenant_id()`) | Done in migration |
| Safety assertion (`assert_tenant_set()`) | Done in migration |
| RLS policies use `current_tenant_id()` | Done; fallback to auth.uid() when not set |
| Server runs procedures inside tenant context (AsyncLocalStorage) | Done in tRPC middleware |
| Tenant resolved from context (organizationId) | Done in tenantResolver |
| SET LOCAL injection helper | Done; use when Postgres connection available |
| Automated tests | Pass (tenantIsolation.test.ts) |
| SET LOCAL (not SET SESSION) for pooling | Done (set_config(..., true)) |

---

**Conclusion:** The tenant guardrail layer is in place at the database and server context level. For full enforcement on Supabase Postgres, ensure the app runs `set_config('app.tenant_id', organizationId, true)` at the start of each request on the Postgres connection used for that request (e.g. when switching `server/db.ts` to a Postgres driver with request-scoped connections).
