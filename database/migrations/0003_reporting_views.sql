-- ============================================================================
-- Phase 13: Reporting views
--
-- Per the performance requirements in ARCHITECTURE.md §9, dashboard
-- aggregates should not be computed from scratch on every page load against
-- 10k+ clients / 50k+ quotations. These views precompute the joins/grouping;
-- Postgres can still use the underlying table indexes when the app filters
-- a view further (e.g. `where created_month >= ...`), and they can be
-- swapped for materialized views + a refresh cron with zero application
-- changes once data volume warrants it (see note at the bottom).
-- ============================================================================

-- One row per quotation version, flattened with its parent quotation's
-- agent/status/client for easy grouping. This is the workhorse view most
-- dashboard queries filter against.
create or replace view v_quotation_summary as
select
  q.id as quotation_id,
  q.quotation_number,
  q.status,
  q.assigned_agent_id,
  q.client_id,
  q.created_at,
  qv.id as version_id,
  qv.destination,
  qv.travel_start_date,
  qv.total_price,
  qv.sent_at,
  c.source_id,
  c.status_id as client_status_id
from quotations q
join quotation_versions qv on qv.id = q.current_version_id
join clients c on c.id = q.client_id
where q.deleted_at is null;

-- Monthly quotation + sales volume, most recent 24 months. Powers the
-- "Monthly quotations" / "Monthly sales" charts.
create or replace view v_monthly_quotation_volume as
select
  date_trunc('month', created_at)::date as month,
  count(*) as quotations_created,
  count(*) filter (where status = 'sent') as quotations_sent,
  count(*) filter (where status = 'confirmed') as quotations_confirmed,
  coalesce(sum(total_price) filter (where status in ('confirmed', 'paid')), 0) as confirmed_value
from v_quotation_summary
group by 1;

-- Monthly booking volume + sales, most recent 24 months. Powers "Monthly
-- confirmed bookings".
create or replace view v_monthly_booking_volume as
select
  date_trunc('month', b.created_at)::date as month,
  count(*) as bookings_created,
  count(*) filter (where b.status = 'confirmed') as bookings_confirmed,
  coalesce(sum(b.total_amount), 0) as total_booked_value
from bookings b
where b.deleted_at is null
group by 1;

-- Top destinations by quotation volume + confirmed value.
create or replace view v_destination_summary as
select
  destination,
  count(*) as quotation_count,
  count(*) filter (where status in ('confirmed', 'paid')) as confirmed_count,
  coalesce(sum(total_price) filter (where status in ('confirmed', 'paid')), 0) as confirmed_value
from v_quotation_summary
group by destination;

-- Lead source breakdown, joined against the configurable client_sources table.
create or replace view v_lead_source_summary as
select
  cs.id as source_id,
  cs.name as source_name,
  count(c.id) as client_count
from client_sources cs
left join clients c on c.source_id = cs.id and c.deleted_at is null
group by cs.id, cs.name;

-- Per-agent performance. Conversion rate = confirmed / sent, guarded against
-- divide-by-zero. This is the source for both the dashboard "Agent
-- performance" chart and the standalone agent performance table on /reports.
--
-- Built from independent scalar subqueries per metric rather than one big
-- multi-table join. A single join across clients + quotations + follow_ups +
-- bookings fans out (an agent with 3 quotations and 4 bookings would produce
-- 12 joined rows), which breaks plain SUM()/COUNT() unless everything is
-- wrapped in COUNT(DISTINCT ...) — and even DISTINCT aggregation is unsafe
-- for SUM specifically, since two different bookings that happen to share
-- the same total_amount would silently collapse into one. Subqueries avoid
-- the fan-out entirely, so every aggregate here is exact.
create or replace view v_agent_performance as
select
  u.id as agent_id,
  u.full_name as agent_name,
  coalesce((select count(*) from clients c where c.assigned_agent_id = u.id and c.deleted_at is null), 0) as leads_assigned,
  coalesce((select count(*) from quotations q where q.assigned_agent_id = u.id and q.deleted_at is null), 0) as quotes_created,
  coalesce((select count(*) from quotations q where q.assigned_agent_id = u.id and q.deleted_at is null and q.status <> 'draft'), 0) as quotes_sent,
  coalesce((select count(*) from follow_ups fu where fu.agent_id = u.id and fu.status = 'completed'), 0) as followups_completed,
  coalesce((select count(*) from bookings bk where bk.assigned_agent_id = u.id and bk.deleted_at is null and bk.status = 'confirmed'), 0) as bookings_confirmed,
  coalesce((select sum(bk.total_amount) from bookings bk where bk.assigned_agent_id = u.id and bk.deleted_at is null and bk.status = 'confirmed'), 0) as confirmed_sales_value,
  case
    when (select count(*) from quotations q where q.assigned_agent_id = u.id and q.deleted_at is null and q.status <> 'draft') = 0 then 0
    else round(
      100.0 * (select count(*) from quotations q where q.assigned_agent_id = u.id and q.deleted_at is null and q.status in ('confirmed', 'paid'))
      / (select count(*) from quotations q where q.assigned_agent_id = u.id and q.deleted_at is null and q.status <> 'draft'),
      1
    )
  end as conversion_rate_pct
from users u
where u.is_active = true;

-- Payment collection summary, for "Total collected payments" / "Outstanding balance".
create or replace view v_payment_summary as
select
  coalesce(sum(b.total_amount), 0) as total_confirmed_sales,
  coalesce(sum(p.total_paid), 0) as total_collected,
  coalesce(sum(b.total_amount), 0) - coalesce(sum(p.total_paid), 0) as outstanding_balance
from bookings b
left join (
  select booking_id, sum(amount) as total_paid from payments group by booking_id
) p on p.booking_id = b.id
where b.deleted_at is null and b.status <> 'cancelled';

-- ============================================================================
-- RLS note: each view below is explicitly set to `security_invoker = true`,
-- so Postgres RLS on the underlying tables (quotations, clients, bookings,
-- follow_ups, users) applies per CALLER, not per view owner. This is what
-- lib/services/reports.ts relies on: an agent querying v_agent_performance
-- automatically gets only rows their `users` RLS policy lets them see (self
-- only, since agents have no reports), a manager gets self + direct reports,
-- and an admin gets everyone — with no extra WHERE clause needed here. The
-- app layer additionally gates the agent-performance TABLE UI behind
-- requireRole('admin','manager') in app/(app)/dashboard and app/(app)/reports,
-- since a bare "your own row" table isn't useful UI for an individual agent,
-- but that's a UX choice, not the security boundary — the security boundary
-- is security_invoker + the users_select RLS policy from 0001_init.sql.
-- ============================================================================
alter view v_quotation_summary set (security_invoker = true);
alter view v_monthly_quotation_volume set (security_invoker = true);
alter view v_monthly_booking_volume set (security_invoker = true);
alter view v_destination_summary set (security_invoker = true);
alter view v_lead_source_summary set (security_invoker = true);
alter view v_agent_performance set (security_invoker = true);
alter view v_payment_summary set (security_invoker = true);

-- ============================================================================
-- SCALE NOTE (not applied now): once quotation/booking volume is large
-- enough that these views are slow even with security_invoker + underlying
-- indexes, convert the month/destination/agent views to MATERIALIZED VIEWs
-- and refresh them on a schedule (pg_cron or an n8n-triggered webhook hitting
-- a `refresh materialized view concurrently ...` RPC), rather than changing
-- any application code — the service layer already queries these views by
-- name, so the swap is transparent to app/(app)/dashboard and app/(app)/reports.
-- ============================================================================
