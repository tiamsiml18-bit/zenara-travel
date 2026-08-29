import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * All queries in this file read from the views in
 * database/migrations/0003_reporting_views.sql, which are declared with
 * `security_invoker = true`. That means Postgres RLS on the underlying
 * tables (quotations, bookings, clients, follow_ups) still applies per
 * caller — an agent calling any function here automatically gets numbers
 * scoped to their own data, a manager gets their team, and an admin gets
 * everything. No extra WHERE clause is needed in this file to enforce that;
 * it falls out of RLS the same way it does for every other list page.
 */

export interface DashboardFilters {
  dateFrom?: string;
  dateTo?: string;
  agentId?: string;
  destination?: string;
  status?: string;
  sourceId?: string;
}

/** Top-line KPI cards. */
export async function getDashboardKpis(supabase: SupabaseClient, filters: DashboardFilters = {}) {
  let quotationsQuery = supabase.from('v_quotation_summary').select('status, total_price, created_at, destination');
  quotationsQuery = applyCommonFilters(quotationsQuery, filters);

  const { data: quotations, error } = await quotationsQuery;
  if (error) throw new Error(`Failed to load dashboard KPIs: ${error.message}`);
  const rows = quotations ?? [];

  const { data: clientsAgg } = await supabase
    .from('clients')
    .select('id, created_at', { count: 'exact', head: false })
    .is('deleted_at', null);

  const totalLeads = clientsAgg?.length ?? 0;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const newLeads = (clientsAgg ?? []).filter((c) => new Date(c.created_at) >= thirtyDaysAgo).length;

  // Follow-up rows never actually get a stored status of 'due' or
  // 'overdue' — see lib/services/followups.ts, which derives those buckets
  // from due_date vs today rather than a status column. Mirror that logic
  // here instead of trusting status values that are never written.
  const today = new Date().toISOString().slice(0, 10);
  const { data: followUpsDue } = await supabase
    .from('follow_ups')
    .select('id', { count: 'exact', head: true })
    .lte('due_date', today)
    .in('status', ['pending', 'due', 'overdue']);

  const { data: payments } = await supabase.from('v_payment_summary').select('*').maybeSingle();

  // "Confirmed bookings" is a count of real `bookings` rows, not quotations
  // whose status happens to be 'confirmed' — a quotation can sit at
  // 'confirmed' before an agent has actually run Convert to Booking, and the
  // two numbers should never silently drift apart. Counts confirmed,
  // in_progress, AND completed bookings together — a trip that's already
  // happened was still a confirmed booking at some point, and excluding it
  // the moment its lifecycle moves past "confirmed" made this KPI misleadingly
  // low. Only 'pending' (not yet actually confirmed) and 'cancelled' are
  // excluded. Every other confirmed-bookings figure on this dashboard (the
  // monthly chart, agent performance) already reads from the real table;
  // this KPI now matches them. The date/agent/destination filters that apply
  // to the quotation-based KPIs above are mirrored here (status/source don't
  // translate to a booking row, so they're intentionally not applied).
  let confirmedBookingsQuery = supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)
    .in('status', ['confirmed', 'in_progress', 'completed']);
  if (filters.dateFrom) confirmedBookingsQuery = confirmedBookingsQuery.gte('created_at', filters.dateFrom);
  if (filters.dateTo) confirmedBookingsQuery = confirmedBookingsQuery.lte('created_at', filters.dateTo);
  if (filters.agentId) confirmedBookingsQuery = confirmedBookingsQuery.eq('assigned_agent_id', filters.agentId);
  if (filters.destination) confirmedBookingsQuery = confirmedBookingsQuery.ilike('destination', `%${filters.destination}%`);
  const { count: confirmedBookingsCount } = await confirmedBookingsQuery;

  const quotesSent = rows.filter((r) => r.status !== 'draft').length;
  const quotesPending = rows.filter((r) => ['sent', 'viewed'].includes(r.status)).length;
  const lostLeads = rows.filter((r) => ['lost', 'expired'].includes(r.status)).length;
  const totalQuotedValue = rows.reduce((sum, r) => sum + Number(r.total_price ?? 0), 0);
  const totalConfirmedSales = rows
    .filter((r) => ['confirmed', 'paid'].includes(r.status))
    .reduce((sum, r) => sum + Number(r.total_price ?? 0), 0);

  return {
    totalLeads,
    newLeads,
    quotesSent,
    quotesPending,
    followUpsNeedingAttention: followUpsDue?.length ?? 0,
    confirmedBookings: confirmedBookingsCount ?? 0,
    lostLeads,
    totalQuotedValue,
    totalConfirmedSales,
    totalCollectedPayments: Number(payments?.total_collected ?? 0),
    outstandingBalance: Number(payments?.outstanding_balance ?? 0),
    // Profit figures require the internal pricing table, which is
    // deliberately restricted to admin/manager/owning-agent (see
    // quotation_pricing_internal RLS in 0001_init.sql). getProfitSummary()
    // below is a separate, explicitly-gated call rather than folded into
    // this general KPI function, so a careless future change to this
    // function can't accidentally widen who sees profit data.
  };
}

/**
 * Estimated/actual profit. Deliberately separate from getDashboardKpis and
 * gated with requireRole at the call site (see app/(app)/dashboard/page.tsx)
 * — this is the one place in the reporting layer that touches
 * quotation_pricing_internal, and it should stay easy to audit.
 */
export async function getProfitSummary(supabase: SupabaseClient) {
  const { data: confirmedVersions, error } = await supabase
    .from('quotations')
    .select('current_version_id, status')
    .in('status', ['confirmed', 'paid'])
    .is('deleted_at', null);
  if (error) throw new Error(error.message);

  const versionIds = (confirmedVersions ?? []).map((q) => q.current_version_id).filter(Boolean) as string[];
  if (versionIds.length === 0) return { estimatedProfit: 0, actualProfit: 0 };

  const { data: pricing } = await supabase
    .from('quotation_pricing_internal')
    .select('quotation_version_id, profit')
    .in('quotation_version_id', versionIds);

  const estimatedProfit = (pricing ?? []).reduce((sum, p) => sum + Number(p.profit ?? 0), 0);

  // "Actual" profit narrows to bookings that have collected at least one
  // payment — a simple proxy for "money has actually moved" without
  // duplicating a full accounting engine (Zoho remains the source of truth).
  const { data: paidBookingVersionIds } = await supabase
    .from('bookings')
    .select('quotation_version_id, payments!inner(id)')
    .is('deleted_at', null);

  const paidSet = new Set((paidBookingVersionIds ?? []).map((b) => b.quotation_version_id));
  const actualProfit = (pricing ?? [])
    .filter((p) => paidSet.has(p.quotation_version_id))
    .reduce((sum, p) => sum + Number(p.profit ?? 0), 0);

  return { estimatedProfit, actualProfit };
}

export async function getMonthlyQuotationVolume(supabase: SupabaseClient, filters: DashboardFilters = {}) {
  // Unfiltered path uses the precomputed view (cheap, index-backed). Any
  // filter narrows the dataset enough that grouping the filtered rows in
  // JS is simpler and just as fast than maintaining a second, dynamically-
  // filterable SQL aggregation — see the scale note at the bottom of
  // 0003_reporting_views.sql for when this should move to a proper RPC.
  if (!hasAnyFilter(filters)) {
    const { data, error } = await supabase
      .from('v_monthly_quotation_volume')
      .select('*')
      .order('month', { ascending: true })
      .limit(12);
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  let query = supabase.from('v_quotation_summary').select('status, total_price, created_at');
  query = applyCommonFilters(query, filters);
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return groupByMonth(data ?? [], (rows) => ({
    quotations_created: rows.length,
    quotations_sent: rows.filter((r) => r.status !== 'draft').length,
    quotations_confirmed: rows.filter((r) => r.status === 'confirmed').length,
    confirmed_value: rows
      .filter((r) => ['confirmed', 'paid'].includes(r.status))
      .reduce((sum, r) => sum + Number(r.total_price ?? 0), 0),
  }));
}

export async function getMonthlyBookingVolume(supabase: SupabaseClient, filters: DashboardFilters = {}) {
  // Bookings don't carry a quotation status or lead source, so only the
  // dimensions that actually apply to a booking row are honored here —
  // status/source filters are quotation-shaped and intentionally ignored
  // for this chart rather than silently misapplied to the wrong column.
  const bookingFilters: DashboardFilters = { dateFrom: filters.dateFrom, dateTo: filters.dateTo, agentId: filters.agentId, destination: filters.destination };

  if (!hasAnyFilter(bookingFilters)) {
    const { data, error } = await supabase
      .from('v_monthly_booking_volume')
      .select('*')
      .order('month', { ascending: true })
      .limit(12);
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  let query = supabase.from('bookings').select('status, total_amount, created_at, assigned_agent_id, destination').is('deleted_at', null);
  if (bookingFilters.dateFrom) query = query.gte('created_at', bookingFilters.dateFrom);
  if (bookingFilters.dateTo) query = query.lte('created_at', bookingFilters.dateTo);
  if (bookingFilters.agentId) query = query.eq('assigned_agent_id', bookingFilters.agentId);
  if (bookingFilters.destination) query = query.ilike('destination', `%${bookingFilters.destination}%`);
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return groupByMonth(data ?? [], (rows) => ({
    bookings_created: rows.length,
    bookings_confirmed: rows.filter((r) => r.status === 'confirmed').length,
    total_booked_value: rows.reduce((sum, r) => sum + Number(r.total_amount ?? 0), 0),
  }));
}

export async function getTopDestinations(supabase: SupabaseClient, limit = 8, filters: DashboardFilters = {}) {
  if (!hasAnyFilter(filters)) {
    const { data, error } = await supabase
      .from('v_destination_summary')
      .select('*')
      .order('quotation_count', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  let query = supabase.from('v_quotation_summary').select('destination, status, total_price');
  query = applyCommonFilters(query, filters);
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const byDestination = new Map<string, { quotation_count: number; confirmed_count: number; confirmed_value: number }>();
  for (const row of data ?? []) {
    const entry = byDestination.get(row.destination) ?? { quotation_count: 0, confirmed_count: 0, confirmed_value: 0 };
    entry.quotation_count += 1;
    if (['confirmed', 'paid'].includes(row.status)) {
      entry.confirmed_count += 1;
      entry.confirmed_value += Number(row.total_price ?? 0);
    }
    byDestination.set(row.destination, entry);
  }

  return Array.from(byDestination.entries())
    .map(([destination, v]) => ({ destination, ...v }))
    .sort((a, b) => b.quotation_count - a.quotation_count)
    .slice(0, limit);
}

export async function getLeadSourceBreakdown(supabase: SupabaseClient, filters: DashboardFilters = {}) {
  if (!hasAnyFilter(filters)) {
    const { data, error } = await supabase.from('v_lead_source_summary').select('*').order('client_count', { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  // Filtered view: "clients with at least one quotation matching the
  // filters", grouped by source. Distinct on client_id so a client with
  // several matching quotations is still counted once, matching the
  // unfiltered view's per-client semantics.
  let query = supabase.from('v_quotation_summary').select('client_id, source_id');
  query = applyCommonFilters(query, filters);
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const { data: sources } = await supabase.from('client_sources').select('id, name');
  const nameById = new Map((sources ?? []).map((s) => [s.id, s.name]));

  const clientsBySource = new Map<string, Set<string>>();
  for (const row of data ?? []) {
    if (!row.source_id) continue;
    const set = clientsBySource.get(row.source_id) ?? new Set<string>();
    set.add(row.client_id);
    clientsBySource.set(row.source_id, set);
  }

  return Array.from(clientsBySource.entries())
    .map(([source_id, clients]) => ({ source_id, source_name: nameById.get(source_id) ?? 'Unknown', client_count: clients.size }))
    .sort((a, b) => b.client_count - a.client_count);
}

export async function getAgentPerformance(supabase: SupabaseClient, agentId?: string) {
  let query = supabase.from('v_agent_performance').select('*').order('confirmed_sales_value', { ascending: false });
  if (agentId) query = query.eq('agent_id', agentId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getConversionRate(supabase: SupabaseClient, filters: DashboardFilters = {}) {
  let query = supabase.from('v_quotation_summary').select('status');
  query = applyCommonFilters(query, filters);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const sent = rows.filter((r) => r.status !== 'draft').length;
  const confirmed = rows.filter((r) => ['confirmed', 'paid'].includes(r.status)).length;
  return sent === 0 ? 0 : Math.round((confirmed / sent) * 1000) / 10;
}

function hasAnyFilter(filters: DashboardFilters): boolean {
  return Boolean(filters.dateFrom || filters.dateTo || filters.agentId || filters.destination || filters.status || filters.sourceId);
}

/**
 * Groups arbitrary rows with a `created_at` field into month buckets and
 * applies `aggregate` to each bucket's rows, returning them sorted
 * ascending — the same shape the precomputed monthly views return, so
 * callers (and the chart components) don't need to know which path ran.
 */
function groupByMonth<T extends { created_at: string }, R extends Record<string, unknown>>(
  rows: T[],
  aggregate: (rowsInMonth: T[]) => R
): (R & { month: string })[] {
  const byMonth = new Map<string, T[]>();
  for (const row of rows) {
    const month = `${row.created_at.slice(0, 7)}-01`; // YYYY-MM-01
    const bucket = byMonth.get(month) ?? [];
    bucket.push(row);
    byMonth.set(month, bucket);
  }
  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, rowsInMonth]) => ({ month, ...aggregate(rowsInMonth) }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyCommonFilters(query: any, filters: DashboardFilters) {
  if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
  if (filters.dateTo) query = query.lte('created_at', filters.dateTo);
  if (filters.agentId) query = query.eq('assigned_agent_id', filters.agentId);
  if (filters.destination) query = query.ilike('destination', `%${filters.destination}%`);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.sourceId) query = query.eq('source_id', filters.sourceId);
  return query;
}
