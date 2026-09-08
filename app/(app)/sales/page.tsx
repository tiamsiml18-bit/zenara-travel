import Link from 'next/link';
import { Topbar } from '@/components/layout/topbar';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { AutoSubmitSelect } from '@/components/ui/auto-submit-select';
import { AutoSubmitDateInput } from '@/components/ui/auto-submit-date-input';
import { SalesTable, type SalesRow } from '@/components/sales/sales-table';
import { SalesSourceToggle } from '@/components/sales/sales-source-toggle';
import { AddHistoricalSaleButton } from '@/components/sales/add-historical-sale-button';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import { listSalesRecords, listUpcomingPayments, getSalesSummary, SALES_PAYMENT_STATUS_LABELS, type SalesPaymentStatus } from '@/lib/services/sales';
import { listHistoricalSales } from '@/lib/services/historical-sales';
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
    source?: string;
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
  const source = (params.source === 'crm' || params.source === 'historical' ? params.source : 'all') as 'all' | 'crm' | 'historical';

  const [crmRecords, historicalRecords, upcoming, agents] = await Promise.all([
    listSalesRecords(supabase, {
      search: params.search,
      paymentStatus: params.paymentStatus as SalesPaymentStatus | undefined,
      agentId: params.agentId,
      travelDateFrom: params.travelFrom,
      travelDateTo: params.travelTo,
      invoiceDateFrom: params.invoiceFrom,
      invoiceDateTo: params.invoiceTo,
    }),
    listHistoricalSales(supabase, {
      search: params.search,
      paymentStatus: params.paymentStatus,
      invoiceDateFrom: params.invoiceFrom,
      invoiceDateTo: params.invoiceTo,
      travelDateFrom: params.travelFrom,
      travelDateTo: params.travelTo,
    }),
    listUpcomingPayments(supabase),
    listAgents(supabase),
  ]);

  // Unify both sources into the one shape SalesTable already renders —
  // CRM rows keep every field exactly as listSalesRecords already
  // produced it; nothing about the existing CRM calculation changed.
  const crmRows: SalesRow[] = crmRecords.map((r) => ({ dataSource: 'crm', ...r }));
  const historicalRows: SalesRow[] = historicalRecords.map((r) => ({
    dataSource: 'historical',
    historicalId: r.historicalId,
    quotationId: r.linkedQuotationId,
    quotationNumber: r.quotationRef,
    customerId: r.linkedClientId,
    customerName: r.customerName,
    invoiceDate: r.invoiceDate ?? '',
    travelStartDate: r.travelDate ?? '',
    totalSale: r.totalSale,
    amountPaid: r.amountPaid,
    balance: r.balance,
    paymentStatus: r.paymentStatus as SalesPaymentStatus,
    paymentDueDate: r.paymentDueDate,
    agentName: r.agentName,
    zohoInvoiceNumber: r.zohoInvoiceNumber,
    airfareCost: r.airfareCost,
    hotelCost: r.hotelCost,
    transferCost: r.transferCost,
    tourCost: r.tourCost,
    bankCharge: r.bankCharge,
    refund: r.refund,
    totalCost: r.totalCost,
    netProfit: r.netProfit,
    remarks: r.remarks,
  }));

  const rows = source === 'crm' ? crmRows : source === 'historical' ? historicalRows : [...crmRows, ...historicalRows];

  // Summary cards reflect exactly the selected view, per spec — All Sales
  // combines both, CRM/Historical show only their own totals. Historical
  // rows only ever enter Upcoming/Overdue counts here if they carry an
  // explicit payment due date (see below), never a computed default.
  const today = new Date().toISOString().slice(0, 10);
  const historicalUpcoming = historicalRows.filter((r) => r.paymentDueDate && r.paymentStatus !== 'paid' && r.balance > 0);
  const summaryRows =
    source === 'crm'
      ? crmRecords
      : source === 'historical'
        ? historicalRows.map((r) => ({ ...r, bookingId: '' }))
        : [...crmRecords, ...historicalRows.map((r) => ({ ...r, bookingId: '' }))];
  const baseSummary = getSalesSummary(summaryRows as Parameters<typeof getSalesSummary>[0]);
  const summary =
    source === 'crm'
      ? baseSummary
      : {
          ...baseSummary,
          upcomingPayments: baseSummary.upcomingPayments + (source === 'historical' ? 0 : historicalUpcoming.filter((r) => r.paymentDueDate! >= today).length),
          overduePayments: baseSummary.overduePayments + (source === 'historical' ? 0 : historicalUpcoming.filter((r) => r.paymentDueDate! < today).length),
        };

  const statusOptions = (Object.keys(SALES_PAYMENT_STATUS_LABELS) as SalesPaymentStatus[]).map((s) => ({
    value: s,
    label: SALES_PAYMENT_STATUS_LABELS[s],
  }));

  function buildHref(nextSource: 'all' | 'crm' | 'historical') {
    const sp = new URLSearchParams();
    if (nextSource !== 'all') sp.set('source', nextSource);
    for (const [k, v] of Object.entries(params)) {
      if (k === 'source' || !v) continue;
      sp.set(k, v);
    }
    const qs = sp.toString();
    return qs ? `/sales?${qs}` : '/sales';
  }

  // Export always follows the currently selected filters (spec: "must
  // respect the filters currently selected") — the same query string the
  // page itself is using, just against the export routes instead. Export
  // is scoped to CRM Sales (the columns/fields the spec's export section
  // describes), so `source` itself is never part of the export query.
  function buildExportHref(kind: 'pdf' | 'excel') {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (k === 'source' || !v) continue;
      sp.set(k, v);
    }
    const qs = sp.toString();
    return `/api/sales/export/${kind}${qs ? `?${qs}` : ''}`;
  }

  // Historical rows with their own explicit due date, not yet paid,
  // merged into the same Upcoming Payments list the CRM side already
  // produces -- per spec, never included unless that date was actually
  // entered, and never a second reminder system of its own.
  const combinedUpcoming = [
    ...upcoming,
    ...historicalUpcoming.map((r) => ({
      bookingId: `hist-${r.historicalId}`,
      quotationId: r.quotationId,
      quotationNumber: r.quotationNumber,
      customerId: r.customerId,
      customerName: r.customerName,
      travelStartDate: r.travelStartDate,
      balance: r.balance,
      paymentStatus: r.paymentStatus as SalesPaymentStatus,
      paymentDueDate: r.paymentDueDate as string,
      daysRemaining: Math.round((new Date(r.paymentDueDate as string).getTime() - new Date(today).getTime()) / 86400000),
    })),
  ].sort((a, b) => (a.paymentDueDate < b.paymentDueDate ? -1 : a.paymentDueDate > b.paymentDueDate ? 1 : 0));

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

        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <SalesSourceToggle current={source} buildHref={buildHref} />
          <div className="flex gap-2">
            <a href={buildExportHref('pdf')} className="rounded-md border border-sand-200 px-3 py-2 text-sm font-medium text-ink-700 hover:bg-sand-100">
              Export PDF
            </a>
            <a href={buildExportHref('excel')} className="rounded-md border border-sand-200 px-3 py-2 text-sm font-medium text-ink-700 hover:bg-sand-100">
              Export Excel
            </a>
            <AddHistoricalSaleButton />
            <Link href="/sales/import" className="rounded-md border border-sand-200 px-3 py-2 text-sm font-medium text-ink-700 hover:bg-sand-100">
              Import Historical Sales
            </Link>
          </div>
        </div>

        <form className="mb-4 flex flex-wrap items-center gap-2" action="/sales">
          <input type="hidden" name="source" value={source} />
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
            <Link href={buildHref(source)} className="text-sm text-ink-500 hover:underline">
              Clear filters
            </Link>
          )}
        </form>

        <SalesTable rows={rows} />

        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-700">Upcoming Payments</h2>
          {combinedUpcoming.length === 0 ? (
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
                  {combinedUpcoming.map((r) => (
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
