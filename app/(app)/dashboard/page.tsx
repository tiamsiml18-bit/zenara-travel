import { Topbar } from '@/components/layout/topbar';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { MonthlyVolumeChart } from '@/components/dashboard/monthly-volume-chart';
import { AgentPerformanceTable } from '@/components/dashboard/agent-performance-table';
import { UpcomingTravelWidget } from '@/components/dashboard/upcoming-travel-widget';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import { getPipelineDashboardCounts } from '@/lib/services/pipeline';
import {
  getDashboardKpis,
  getProfitSummary,
  getMonthlyQuotationVolume,
  getAgentPerformance,
  getConversionRate,
  getUpcomingConfirmedTravel,
} from '@/lib/services/reports';

function formatMoney(n: number) {
  return `PHP ${Math.round(n).toLocaleString('en-PH')}`;
}

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const canSeeProfit = user.role === 'admin' || user.role === 'manager';
  const canSeeAgentTable = user.role === 'admin' || user.role === 'manager';

  const [kpis, monthlyQuotations, conversionRate, agentPerformance, profit, pipelineCounts, upcomingTravel] = await Promise.all([
    getDashboardKpis(supabase),
    getMonthlyQuotationVolume(supabase),
    getConversionRate(supabase),
    canSeeAgentTable ? getAgentPerformance(supabase) : Promise.resolve([]),
    // Profit touches quotation_pricing_internal — RLS already restricts
    // rows to admin/manager/owning-agent, but we also skip the call
    // entirely for agents so the dashboard never even asks for it.
    canSeeProfit ? getProfitSummary(supabase) : Promise.resolve(null),
    getPipelineDashboardCounts(supabase),
    getUpcomingConfirmedTravel(supabase),
  ]);

  return (
    <>
      <Topbar title="Dashboard" />
      <main className="flex-1 overflow-y-auto p-6">
        <p className="mb-5 text-sm text-ink-500">
          Welcome back, {user.fullName.split(' ')[0]}. Here's where things stand
          {user.role === 'agent' ? ' for your clients' : ' across the agency'}.
        </p>

        {/* One condensed KPI row — the essentials, at a glance, no
            secondary "Sales pipeline" section duplicating Confirmed/Lost
            counts already shown here (that detail still lives on the
            pipeline board itself). Top destinations and Lead sources
            breakdowns were removed for a leaner daily view — that detail
            is still one click away on Reports. Monthly quotations stays,
            per explicit request. */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          <KpiCard label="Total leads" value={String(kpis.totalLeads)} hint={`+${kpis.newLeads} last 30 days`} />
          <KpiCard label="Quotes sent" value={String(kpis.quotesSent)} />
          <KpiCard
            label="Follow-ups due"
            value={String(kpis.followUpsNeedingAttention)}
            tone={kpis.followUpsNeedingAttention > 0 ? 'warning' : 'default'}
          />
          <KpiCard label="Negotiating" value={String(pipelineCounts.negotiating)} />
          <KpiCard label="Confirmed bookings" value={String(kpis.confirmedBookings)} tone="positive" />
          <KpiCard label="Conversion rate" value={`${conversionRate}%`} />
          <KpiCard label="Confirmed sales" value={formatMoney(kpis.totalConfirmedSales)} tone="positive" />
          <KpiCard label="Collected payments" value={formatMoney(kpis.totalCollectedPayments)} tone="positive" />
          <KpiCard
            label="Outstanding balance"
            value={formatMoney(kpis.outstandingBalance)}
            tone={kpis.outstandingBalance > 0 ? 'warning' : 'default'}
          />
          {canSeeProfit && profit && <KpiCard label="Actual profit" value={formatMoney(profit.actualProfit)} tone="positive" />}
          <KpiCard label="Lost leads" value={String(kpis.lostLeads)} tone={kpis.lostLeads > 0 ? 'negative' : 'default'} />
          <KpiCard label="No response" value={String(pipelineCounts.noResponse)} tone={pipelineCounts.noResponse > 0 ? 'warning' : 'default'} />
        </div>

        <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <UpcomingTravelWidget rows={upcomingTravel} />
          <MonthlyVolumeChart
            title="Monthly quotations"
            data={monthlyQuotations.map((m) => ({
              month: m.month,
              created: m.quotations_created,
              confirmed: m.quotations_confirmed,
            }))}
          />
        </div>

        {canSeeAgentTable && (
          <section className="rounded-lg border border-sand-200 bg-white p-5">
            <h3 className="mb-3 font-display text-sm font-semibold text-ink-900">Agent performance</h3>
            <AgentPerformanceTable rows={agentPerformance} />
          </section>
        )}

        <p className="mt-6 text-xs text-ink-500">
          Top destinations, lead sources, and the full breakdown by date range, agent, and status live on{' '}
          <a href="/reports" className="font-medium text-harbor-600 hover:underline">
            Reports
          </a>
          .
        </p>
      </main>
    </>
  );
}
