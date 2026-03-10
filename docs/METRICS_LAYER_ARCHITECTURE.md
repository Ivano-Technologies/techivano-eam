# Metrics Layer Architecture

Techivano follows a **server-side metrics** pattern: the browser receives **precomputed** data and only renders UI. Analytics and aggregations run in the database and API layer, not in the client.

## Pattern: Database → Precomputed metrics → Browser

| Task              | Before (client)     | After (server)        |
|-------------------|---------------------|------------------------|
| Metric calculation| Browser (JS loops)  | Server / database     |
| Sorting derived   | Browser             | Database               |
| Aggregation       | Browser `reduce()`  | SQL `SUM` / `GROUP BY` |
| Filtering         | Browser             | Database               |

React is responsible only for:

- Data display
- User interaction
- Navigation

## Implemented Metrics Layer

### 1. Cost analytics (`getCostAnalytics`)

- **Before:** Fetch all transactions in date range, then in Node: `reduce` for totals, N+1 lookups for category/site/vendor names, client-side grouping.
- **After:** Four aggregated SQL queries:
  - Totals by `transactionType` (`SUM(amount) ... GROUP BY transactionType`)
  - By category: `financialTransactions` ⋈ `assets` ⋈ `assetCategories`, `GROUP BY categoryId`
  - By site: `financialTransactions` ⋈ `assets` ⋈ `sites`, `GROUP BY siteId`
  - By vendor: `financialTransactions` ⋈ `vendors`, `GROUP BY vendorId`, top 10
- **API:** `financial.getCostAnalytics({ days })` — used by Cost Analytics page. No raw rows sent for aggregation.

### 2. Financial summary (`getFinancialSummary`)

- **Before:** `financial.list` returned all transactions; client did `reduce` for `totalRevenue` and `totalExpenses`.
- **After:** Server runs `SUM(amount) ... GROUP BY transactionType`, then maps types to revenue vs expenses.
- **API:** `financial.list()` now returns `{ transactions, summary: { totalRevenue, totalExpenses } }`. Totals come from `summary`; list is for display only.

### 3. Maintenance KPIs per asset (`getMaintenanceSummary`)

- **Before:** `workOrders.getByAssetId` returned all work orders; client computed total, completed count, completion rate, and average duration in JS.
- **After:** Server runs:
  - `COUNT(*)` and `SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)` for completion rate
  - `AVG(DATEDIFF(actualEnd, actualStart))` for average duration (MySQL)
- **API:** `workOrders.getByAssetId({ assetId })` now returns `{ workOrders, summary: { total, completed, completionRatePct, avgDurationDays } }`. MaintenanceHistory uses `summary` for stats.

### 4. Dashboard stats (`getDashboardStats`)

- Already server-side: multiple `COUNT(*)` queries for assets, work orders, low stock. No change in pattern; consider a single query or view for further optimization.

## Database views (optional)

For environments using **Postgres** (e.g. Supabase), you can add views or materialized views so more logic lives in the DB:

- **`asset_health_metrics`** — per-asset maintenance count, avg cost, health score
- **`maintenance_kpi_view`** — org-level KPIs (backlog, completion rate, avg duration)
- **`organization_dashboard_view`** — counts and high-level metrics per org

Example (Postgres):

```sql
CREATE MATERIALIZED VIEW asset_health_metrics AS
SELECT
  a.id,
  COUNT(w.id) AS maintenance_count,
  AVG(w.actual_cost::numeric) AS avg_cost,
  -- health_score expression here
FROM assets a
LEFT JOIN work_orders w ON w.asset_id = a.id
GROUP BY a.id;
```

The current implementation uses **Drizzle + MySQL** with aggregated queries in `server/db.ts`; no views are required. Views are recommended when you need:

- Same metrics reused by many endpoints
- Heavy aggregations refreshed on a schedule (materialized views)
- A single place to change metric definitions

## Files touched

| Area            | File(s) |
|-----------------|--------|
| Cost analytics  | `server/db.ts` (`getCostAnalytics`) |
| Financial summary | `server/db.ts` (`getFinancialSummary`), `server/routers.ts` (`financial.list`), `client/src/pages/Financial.tsx` |
| Maintenance KPIs | `server/db.ts` (`getMaintenanceSummary`), `server/routers.ts` (`workOrders.getByAssetId`), `client/src/components/MaintenanceHistory.tsx` |
| Tests           | `server/eam.test.ts` (financial.list expects `{ transactions, summary }`) |

## Benefits

- **Scale:** Database handles large datasets; no “fetch 10k rows and reduce in browser.”
- **Performance:** Fewer round-trips and less JSON; aggregations in DB are much faster than JS loops.
- **Consistency:** One definition of metrics (server/DB); UI just displays.
- **Future:** Easy to add caching, materialized views, or read replicas for reporting.
