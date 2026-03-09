# Phase 4B — Legacy Tenant Field Usage Report

**Purpose:** List all remaining references to `tenantId`, `tenant_id`, and `business_id` before removing legacy columns. **Do not remove columns until code paths are updated and verified.**

---

## 1. Summary

| Category | tenantId | tenant_id | business_id | Action |
|----------|----------|-----------|-------------|--------|
| **Core EAM (server)** | ctx.tenantId, resolveTenantIdFromContext | — | — | Keep for backward compat; prefer ctx.organizationId for DB writes. |
| **Analytics / worker tables** | Heavy use in db.ts, processors, routers | — | — | Tables have no organization_id yet; **do not drop** tenantId. Defer to later phase. |
| **OCR / upload API** | Payload + job | tenant_id in payload | — | Prefer organizationId; keep tenantId for backward compat until workers updated. |
| **tRPC context** | ctx.tenantId | — | — | Retain; used by resolveTenantIdFromContext for analytics jobs. |
| **App routes (src/app)** | — | Supabase .eq("tenant_id", …) | .eq("business_id", …) | Update to organization_id when Supabase tables have it. |
| **Drizzle schema** | Many analytics tables | tenant_organization_map.tenant_id (mapping) | — | Remove only from **inspections** in Phase 4F; leave analytics tables as-is. |

---

## 2. Server routes and tRPC

| Location | Usage | Notes |
|----------|--------|--------|
| `server/_core/context.ts` | TrpcContext.tenantId, resolveOrganizationContext returns tenantId, tenantIdFromCanonicalOrganizationId | Required for backward compat; analytics jobs use tenantId. Keep. |
| `server/routers.ts` | resolveTenantIdFromContext(ctx), tenantId in job payloads for warehouse, vendor, procurement, supply chain, dispatch, executive, reports, job runs | All pass tenantId to analytics/worker services. Those tables only have tenantId. Keep until those tables have organization_id. |
| `server/_core/trpc.ts` | ctx.tenantId | Keep. |
| `server/_core/index.ts` | getOrganizationIdFromRequest returns tenantId; upload/recommendation payloads include tenantId, tenant_id | Prefer organizationId in payloads; keep tenantId for backward compat. |

---

## 3. Worker jobs and queue payloads

| Location | Usage | Notes |
|----------|--------|--------|
| `server/jobs/types.ts` | BaseBackgroundJobPayload.tenantId | Optional organizationId added in Phase 3. Workers still use tenantId for analytics tables. |
| `server/jobs/ocrUploadQueue.ts` | OcrUploadJobPayload.tenantId, tenant_id; enqueue sends both | Already has organizationId. Keep tenantId until all consumers use organizationId. |
| `server/jobs/worker.ts` | payload.tenantId required check | Keep for jobs that still use tenantId. |
| `server/jobs/workerDecrypt.ts` | resolveWorkerTenantId(payload.tenantId \|\| payload.tenant_id) | Resolves for backward compat. Keep. |
| `server/jobs/processors.ts` | payload.tenantId for all analytics job types | Analytics tables (warehouse, vendor, procurement, supply chain, dispatch, executive) use tenantId only. No organization_id. Keep. |

---

## 4. Database layer (server/db.ts)

| Location | Usage | Notes |
|----------|--------|--------|
| getInventoryWarehouseMetrics(tenantId, …) | Filters warehouse_transfer_recommendations by tenantId | Table has tenant_id only. Keep. |
| getVendorScoringInputs(tenantId) | vendor_performance_metrics, vendor_risk_scores | Keep. |
| getProcurementInputSignals(params.tenantId) | procurement_recommendations, vendor_risk_scores | Keep. |
| listVendorRiskScores(params.tenantId) | vendor_risk_scores | Keep. |
| getSupplyChainRiskInputs(params.tenantId) | supply_chain_risk_scores, supply_chain_risk_events | Keep. |
| getDispatchOptimizationInputs(params.tenantId) | technicians, fleet_units, dispatch_assignments | Keep. |
| getExecutiveMetricsInputs(tenantId) | predictive_scores, vendor_risk_scores, supply_chain_risk_scores, fleet_units, dispatch_assignments | Keep. |
| getLatestExecutiveMetricsSnapshot(tenantId) | executive_metrics_snapshots | Keep. |
| getTelemetryAnomalyStats(tenantId, assetId) | telemetry_points | Keep. |
| Job run store (getJobRunById, listRecentJobRuns, etc.) | background_job_runs.tenantId | Keep. |

**Core EAM tables** (assets, workOrders, sites, vendors, inventoryItems, complianceRecords, documents, maintenanceSchedules, assetPhotos, inspections): Already use **organizationId** in getAll* and list APIs. No tenantId in those queries.

---

## 5. Analytics pipelines and intelligence services

| Location | Usage | Notes |
|----------|--------|--------|
| `server/modules/warehouse/warehouseIntelligenceService.ts` | tenantId in inputs | Uses tenantId for warehouse tables. Keep. |
| `server/modules/procurement/procurementService.ts` | tenantId in types | Keep. |
| `server/modules/supplychain/supplyChainRiskService.ts` | tenantId in types | Keep. |
| `server/modules/vendor/vendorIntelligenceService.ts` | (from grep: vendor risk) | Keep. |
| `server/modules/dispatch/dispatchOptimizationService.ts` | (dispatch uses tenantId) | Keep. |

---

## 6. Frontend / App API routes (src/app)

| Location | Usage | Notes |
|----------|--------|--------|
| `src/app/api/expenses/ocr/route.ts` | business_id, tenant_id in params and Supabase .eq("business_id", …) | Separate product; update to organization_id when schema is ready. |
| `src/app/api/transactions/route.ts` | tenant_id, business_id; resolveTenantId; .eq("user_id", tenantId) | Update to organization_id when applicable. |
| `src/app/api/vendor-intelligence/recommendations/route.ts` | tenant_id query param; .eq("tenant_id", tenantId) | Likely Supabase table; use organization_id when available. |
| `src/app/(dashboard)/warehouse-rebalance/page.tsx` | .eq("tenant_id", user.id) | Use organization_id when table has it. |
| `src/app/(dashboard)/command-center/page.tsx` | .eq("tenant_id", user.id) | Same. |
| `src/lib/tenant/context.ts` | tenant_id, business_id in resolveTenantId | Shared helper; can return organizationId when used for org-scoped APIs. |
| `apps/mobile/lib/db/work-order-repository.ts` | tenant_id, tenantId | Mobile app; align with API (organization_id). |

---

## 7. Drizzle schema (drizzle/schema.ts)

| Table / area | Legacy field | organization_id | Phase 4 action |
|--------------|--------------|------------------|-----------------|
| **inspections** | tenantId (int) | Yes | **Remove tenantId** from schema in 4F; drop column in 4E if verified. |
| **documents** | — | Yes | If DB has business_id/tenant_id, drop in 4E migration. |
| **assets, workOrders, sites, vendors, …** | None in schema | Yes | Make organizationId .notNull() in 4F. |
| **tenant_organization_map** | tenant_id (int) — mapping key | organization_id | **Keep** tenant_id; it is the mapping key. |
| **warehouse_transfer_recommendations** | tenantId (tenant_id) | No | Do not drop. Defer. |
| **vendor_performance_metrics, vendor_risk_scores** | tenantId | No | Do not drop. Defer. |
| **procurement_recommendations, purchase_orders** | tenantId | No | Do not drop. Defer. |
| **supply_chain_risk_*, fleet_units, technicians, dispatch_assignments** | tenantId | No | Do not drop. Defer. |
| **executive_metrics_snapshots, operational_kpi_trends** | tenantId | No | Do not drop. Defer. |
| **telemetry_points, telemetry_aggregates, report_snapshots, predictive_scores** | tenantId | No | Do not drop. Defer. |
| **inspection_templates, compliance_rules, compliance_events, sla_metrics, audit_logs** | tenantId | No | Do not drop. Defer. |
| **background_job_runs, ruvector_memories, prime_agent_executions, stock_forecasts** | tenantId | No | Do not drop. Defer. |

---

## 8. Tests

| File | Usage | Notes |
|------|--------|--------|
| tests/tenant-hardening.test.ts | tenant_id, business_id in resolveTenantId | Keep; tests legacy resolution. |
| tests/vendor-intelligence-agent.test.ts | tenantId | Keep. |
| tests/warehouse-intelligence.test.ts | tenantId | Keep. |
| server/*.phase*.test.ts | tenantId in payloads | Keep for analytics job tests. |

---

## 9. Recommended Phase 4 scope

- **Drop legacy columns only from:** inspections (tenantId), and from documents (business_id, tenant_id) if they exist and are unused.
- **Drizzle:** Remove inspections.tenantId; make organizationId `.notNull()` on core tenant tables that have it.
- **Leave unchanged for now:** All analytics/worker tables and their tenantId usage; app routes that use tenant_id/business_id (document for future update).
- **Worker payloads:** Continue including organizationId where applicable; keep tenantId for backward compatibility until analytics tables are migrated to organization_id.
