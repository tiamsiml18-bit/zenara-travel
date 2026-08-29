import { Topbar } from '@/components/layout/topbar';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { MonthlyVolumeChart } from '@/components/dashboard/monthly-volume-chart';
import { RankedBarChart } from '@/components/dashboard/ranked-bar-chart';
import { AgentPerformanceTable } from '@/components/dashboard/agent-performance-table';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import {
  getDashboardKpis,
  getProfitSummary,
  getMonthlyQuotationVolume,
  getMonthlyBookingVolume,
  getTopDestinations,
  getLeadSourceBreakdown,
  getAgentPerformance,
  getConversionRate,
} from '@/lib/services/reports';

function formatMoney(n: number) {
  return `PHP ${Math.round(n).toLocaleString('en-PH')}`;
}

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const canSeeProfit = user.role === 'admin' || user.role === 'manager';
  const canSeeAgentTable = user.role === 'admin' || user.role === 'manager';

  const [kpis, monthlyQuotations, monthlyBookings, topDestinations, leadSources, conversionRate, agentPerformance, profit] =
    await Promise.all([
      getDashboardKpis(supabase),
      getMonthlyQuotationVolume(supabase),
      getMonthlyBookingVolume(supabase),
      getTopDestinations(supabase, 6),
      getLeadSourceBreakdown(supabase),
      getConversionRate(supabase),
      canSeeAgentTable ? getAgentPerformance(supabase) : Promise.resolve([]),
      // Profit touches quotation_pricing_internal — RLS already restricts
      // rows to admin/manager/owning-agent, but we also skip the call
      // entirely for agents so the dashboard never even asks for it.
      canSeeProfit ? getProfitSummary(supabase) : Promise.resolve(null),
    ]);

  return (
    <>
      <Topbar title="Dashboard" />
      <main className="flex-1 overflow-y-auto p-6">
        <p className="mb-5 text-sm text-ink-500">
          Welcome back, {user.fullName.split(' ')[0]}. Here's where things stand
          {user.role === 'agent' ? ' for your clients' : ' across the agency'}.
        </p>

        {/* KPI row */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <KpiCard label="Total leads" value={String(kpis.totalLeads)} hint={`+${kpis.newLeads} last 30 days`} />
          <KpiCard label="Quotes sent" value={String(kpis.quotesSent)} />
          <KpiCard label="Pending response" value={String(kpis.quotesPending)} />
          <KpiCard
            label="Follow-ups due"
            value={String(kpis.followUpsNeedingAttention)}
            tone={kpis.followUpsNeedingAttention > 0 ? 'warning' : 'default'}
          />
          <KpiCard label="Confirmed bookings" value={String(kpis.confirmedBookings)} tone="positive" />
          <KpiCard label="Lost leads" value={String(kpis.lostLeads)} tone={kpis.lostLeads > 0 ? 'negative' : 'default'} />
          <KpiCard label="Total quoted value" value={formatMoney(kpis.totalQuotedValue)} />
          <KpiCard label="Confirmed sales" value={formatMoney(kpis.totalConfirmedSales)} tone="positive" />
          <KpiCard label="Collected payments" value={formatMoney(kpis.totalCollectedPayments)} tone="positive" />
          <KpiCard
            label="Outstanding balance"
            value={formatMoney(kpis.outstandingBalance)}
            tone={kpis.outstandingBalance > 0 ? 'warning' : 'default'}
          />
          {canSeeProfit && profit && (
            <>
              <KpiCard label="Estimated profit" value={formatMoney(profit.estimatedProfit)} tone="positive" />
              <KpiCard label="Actual profit" value={formatMoney(profit.actualProfit)} tone="positive" />
            </>
          )}
          <KpiCard label="Conversion rate" value={`${conversionRate}%`} />
        </div>

        {/* Charts */}
        <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <MonthlyVolumeChart
            title="Monthly quotations"
            data={monthlyQuotations.map((m) => ({
              month: m.month,
              created: m.quotations_created,
              confirmed: m.quotations_confirmed,
            }))}
          />
          <MonthlyVolumeChart
            title="Monthly confirmed bookings & sales"
            data={monthlyBookings.map((m) => ({
              month: m.month,
              created: m.bookings_created,
              confirmed: m.bookings_confirmed,
            }))}
          />
          <RankedBarChart
            title="Top destinations"
            valueLabel="Quotations"
            data={topDestinations.map((d) => ({ label: d.destination, value: d.quotation_count }))}
          />
          <RankedBarChart
            title="Lead sources"
            valueLabel="Clients"
            data={leadSources.map((s) => ({ label: s.source_name, value: s.client_count }))}
          />
        </div>

        {/* Agent performance */}
        {canSeeAgentTable && (
          <section>
            <h3 className="mb-3 font-display text-sm font-semibold text-ink-900">Agent performance</h3>
            <AgentPerformanceTable rows={agentPerformance} />
          </section>
        )}

        <p className="mt-6 text-xs text-ink-500">
          Filters (date range, agent, destination, status, lead source) and the full breakdown live on{' '}
          <a href="/reports" className="font-medium text-harbor-600 hover:underline">
            Reports
          </a>
          .
        </p>
      </main>
    </>
  );
}
