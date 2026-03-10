-- Optional: metrics layer view (Postgres). Main app uses MySQL + Drizzle aggregated queries; this is for
-- analytics/read replicas or when using Postgres. See docs/METRICS_LAYER_ARCHITECTURE.md.
-- Table names below assume Postgres snake_case; adjust if your schema differs.

-- Per-asset maintenance KPIs (count, completed, avg duration). Use in API instead of client-side aggregation.
create or replace view public.asset_maintenance_kpi as
select
  a.id as asset_id,
  count(w.id) as work_order_count,
  count(w.id) filter (where w.status = 'completed') as completed_count,
  case
    when count(w.id) > 0
    then round(100.0 * count(w.id) filter (where w.status = 'completed') / count(w.id), 0)
    else 0
  end as completion_rate_pct,
  avg(
    case
      when w.actual_start is not null and w.actual_end is not null
      then extract(epoch from (w.actual_end - w.actual_start)) / 86400.0
      else null
    end
  ) as avg_duration_days
from public.assets a
left join public.work_orders w on w.asset_id = a.id
group by a.id;

comment on view public.asset_maintenance_kpi is 'Precomputed maintenance KPIs per asset; query this from API instead of aggregating in client.';
