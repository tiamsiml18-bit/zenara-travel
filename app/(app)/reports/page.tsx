import { Topbar } from '@/components/layout/topbar';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { MonthlyVolumeChart } from '@/components/dashboard/monthly-volume-chart';
import { RankedBarChart } from '@/components/dashboard/ranked-bar-chart';
import { AgentPerformanceTable } from '@/components/dashboard/agent-performance-table';
import { ReportFilterBar } from '@/components/reports/report-filter-bar';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import { listAgents, listClientSources } from '@/lib/services/lookups';
import {
  getDashboardKpis,
  getMonthlyQuotationVolume,
  getMonthlyBookingVolume,
  getTopDestinations,
  getLeadSourceBreakdown,
  getAgentPerformance,
  getConversionRate,
  type DashboardFilters,
} from '@/lib/services/reports';

function formatMoney(n: number) {
  return `PHP ${Math.round(n).toLocaleString('en-PH')}`;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; agent?: string; destination?: string; status?: string; source?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const supabase = await createClient();
  const canSeeAgentTable = user.role === 'admin' || user.role === 'manager';

  const filters: DashboardFilters = {
    dateFrom: params.from,
    dateTo: params.to,
    agentId: params.agent,
    destination: params.destination,
    status: params.status,
    sourceId: params.source,
  };

  const [kpis, monthlyQuotations, monthlyBookings, topDestinations, leadSources, conversionRate, agentPerformance, agents, sources] =
    await Promise.all([
      getDashboardKpis(supabase, filters),
      getMonthlyQuotationVolume(supabase, filters),
      getMonthlyBookingVolume(supabase, filters),
      getTopDestinations(supabase, 10, filters),
      getLeadSourceBreakdown(supabase, filters),
      getConversionRate(supabase, filters),
      canSeeAgentTable ? getAgentPerformance(supabase, params.agent) : Promise.resolve([]),
      listAgents(supabase),
      listClientSources(supabase),
    ]);

  return (
    <>
      <Topbar title="Reports" />
      <main className="flex-1 overflow-y-auto p-6">
        <ReportFilterBar
          agents={agents}
          sources={sources}
          defaults={{
            dateFrom: params.from,
            dateTo: params.to,
            agent: params.agent,
            destination: params.destination,
            status: params.status,
            source: params.source,
          }}
        />

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <KpiCard label="Quotes sent" value={String(kpis.quotesSent)} />
          <KpiCard label="Pending response" value={String(kpis.quotesPending)} />
          <KpiCard label="Confirmed bookings" value={String(kpis.confirmedBookings)} tone="positive" />
          <KpiCard label="Lost leads" value={String(kpis.lostLeads)} tone={kpis.lostLeads > 0 ? 'negative' : 'default'} />
          <KpiCard label="Quoted value" value={formatMoney(kpis.totalQuotedValue)} />
          <KpiCard label="Confirmed sales" value={formatMoney(kpis.totalConfirmedSales)} tone="positive" />
        </div>

        <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <MonthlyVolumeChart
            title="Monthly quotations"
            data={monthlyQuotations.map((m) => ({ month: m.month, created: m.quotations_created, confirmed: m.quotations_confirmed }))}
          />
          <MonthlyVolumeChart
            title="Monthly confirmed bookings"
            data={monthlyBookings.map((m) => ({ month: m.month, created: m.bookings_created, confirmed: m.bookings_confirmed }))}
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

        <div className="mb-6 rounded-lg border border-sand-200 bg-white p-5">
          <h3 className="mb-1 font-display text-sm font-semibold text-ink-900">Overall conversion rate</h3>
          <p className="font-ticket text-3xl font-semibold text-harbor-700">{conversionRate}%</p>
          <p className="text-xs text-ink-500">Confirmed quotations ÷ quotations sent, across the filtered range.</p>
        </div>

        {canSeeAgentTable && (
          <section>
            <h3 className="mb-3 font-display text-sm font-semibold text-ink-900">Agent performance</h3>
            <AgentPerformanceTable rows={agentPerformance} />
          </section>
        )}
      </main>
    </>
  );
}
