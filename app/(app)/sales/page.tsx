import Link from 'next/link';
import { Topbar } from '@/components/layout/topbar';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { AutoSubmitSelect } from '@/components/ui/auto-submit-select';
import { AutoSubmitDateInput } from '@/components/ui/auto-submit-date-input';
import { SalesTable } from '@/components/sales/sales-table';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import { listSalesRecords, listUpcomingPayments, getSalesSummary, SALES_PAYMENT_STATUS_LABELS, type SalesPaymentStatus } from '@/lib/services/sales';
import { listAgents } from '@/lib/services/lookups';

function formatMoney(n: number) {
  return `PHP ${Math.round(n).toLocaleString('en-PH')}`;
}
function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(`${d}T00:00:00`).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    paymentStatus?: string;
    agentId?: string;
    travelFrom?: string;
    travelTo?: string;
    invoiceFrom?: string;
    invoiceTo?: string;
  }>;
}) {
  await requireUser();
  const params = await searchParams;
  const supabase = await createClient();

  const [rows, upcoming, agents] = await Promise.all([
    listSalesRecords(supabase, {
      search: params.search,
      paymentStatus: params.paymentStatus as SalesPaymentStatus | undefined,
      agentId: params.agentId,
      travelDateFrom: params.travelFrom,
      travelDateTo: params.travelTo,
      invoiceDateFrom: params.invoiceFrom,
      invoiceDateTo: params.invoiceTo,
    }),
    listUpcomingPayments(supabase),
    listAgents(supabase),
  ]);

  const summary = getSalesSummary(rows);
  const statusOptions = (Object.keys(SALES_PAYMENT_STATUS_LABELS) as SalesPaymentStatus[]).map((s) => ({
    value: s,
    label: SALES_PAYMENT_STATUS_LABELS[s],
  }));

  return (
    <>
      <Topbar title="Sales" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
          <KpiCard label="Total Sales" value={formatMoney(summary.totalSales)} />
          <KpiCard label="Amount Collected" value={formatMoney(summary.amountCollected)} tone="positive" />
          <KpiCard label="Outstanding Balance" value={formatMoney(summary.outstandingBalance)} tone="warning" />
          <KpiCard label="Upcoming Payments" value={String(summary.upcomingPayments)} />
          <KpiCard label="Overdue Payments" value={String(summary.overduePayments)} tone={summary.overduePayments > 0 ? 'negative' : 'default'} />
          <KpiCard label="Total Cost" value={formatMoney(summary.totalCost)} />
          <KpiCard label="Net Profit" value={formatMoney(summary.netProfit)} tone={summary.netProfit >= 0 ? 'positive' : 'negative'} />
        </div>

        <form className="mb-4 flex flex-wrap items-center gap-2" action="/sales">
          <input
            type="text"
            name="search"
            defaultValue={params.search}
            placeholder="Search customer or quotation ref…"
            className="w-64 rounded-md border border-sand-200 px-3 py-2 text-sm"
          />
          <AutoSubmitSelect name="paymentStatus" defaultValue={params.paymentStatus} placeholder="All payment statuses" options={statusOptions} />
          <AutoSubmitSelect
            name="agentId"
            defaultValue={params.agentId}
            placeholder="All agents"
            options={agents.map((a) => ({ value: a.id, label: a.full_name }))}
          />
          <span className="text-xs text-ink-500">Travel date</span>
          <AutoSubmitDateInput name="travelFrom" defaultValue={params.travelFrom} title="Travel date from" />
          <AutoSubmitDateInput name="travelTo" defaultValue={params.travelTo} title="Travel date to" />
          <span className="text-xs text-ink-500">Invoice date</span>
          <AutoSubmitDateInput name="invoiceFrom" defaultValue={params.invoiceFrom} title="Invoice date from" />
          <AutoSubmitDateInput name="invoiceTo" defaultValue={params.invoiceTo} title="Invoice date to" />
          <button type="submit" className="rounded-md bg-harbor-700 px-3 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600">
            Apply
          </button>
          {(params.search || params.paymentStatus || params.agentId || params.travelFrom || params.travelTo || params.invoiceFrom || params.invoiceTo) && (
            <Link href="/sales" className="text-sm text-ink-500 hover:underline">
              Clear filters
            </Link>
          )}
        </form>

        <SalesTable rows={rows} />

        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-700">Upcoming Payments</h2>
          {upcoming.length === 0 ? (
            <p className="rounded-lg border border-sand-200 bg-surface p-4 text-sm text-ink-500">No upcoming or overdue payments.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-sand-200 bg-surface">
              <table className="w-full text-sm">
                <thead className="border-b border-sand-200 bg-sand-50 text-left text-xs font-medium uppercase tracking-wide text-ink-500">
                  <tr>
                    <th className="px-3 py-2">Customer</th>
                    <th className="px-3 py-2">Quotation Ref</th>
                    <th className="px-3 py-2 text-right">Amount Due</th>
                    <th className="px-3 py-2">Payment Due Date</th>
                    <th className="px-3 py-2">Travel Date</th>
                    <th className="px-3 py-2 text-right">Days Remaining</th>
                    <th className="px-3 py-2">Payment Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-100">
                  {upcoming.map((r) => (
                    <tr key={r.bookingId} className="hover:bg-sand-50/60">
                      <td className="px-3 py-2">
                        {r.customerId ? (
                          <Link href={`/clients/${r.customerId}`} className="text-harbor-700 hover:underline">
                            {r.customerName}
                          </Link>
                        ) : (
                          r.customerName
                        )}
                      </td>
                      <td className="px-3 py-2 font-medium">
                        {r.quotationId ? (
                          <Link href={`/quotations/${r.quotationId}`} className="text-harbor-700 hover:underline">
                            {r.quotationNumber}
                          </Link>
                        ) : (
                          r.quotationNumber
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-ticket">{formatMoney(r.balance)}</td>
                      <td className="px-3 py-2 text-ink-500">{formatDate(r.paymentDueDate)}</td>
                      <td className="px-3 py-2 text-ink-500">{formatDate(r.travelStartDate)}</td>
                      <td className={`px-3 py-2 text-right font-ticket ${r.daysRemaining < 0 ? 'font-semibold text-coral-600' : 'text-ink-700'}`}>
                        {r.daysRemaining < 0 ? `${Math.abs(r.daysRemaining)} overdue` : r.daysRemaining}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            r.daysRemaining < 0 ? 'bg-coral-500/10 text-coral-600' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                          }`}
                        >
                          {SALES_PAYMENT_STATUS_LABELS[r.paymentStatus]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
