import Link from 'next/link';
import { Topbar } from '@/components/layout/topbar';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { AutoSubmitSelect } from '@/components/ui/auto-submit-select';
import { AutoSubmitDateInput } from '@/components/ui/auto-submit-date-input';
import { ExpensesTable } from '@/components/expenses/expenses-table';
import { AddExpenseButton } from '@/components/expenses/add-expense-button';
import { CreditCardsPanel } from '@/components/expenses/credit-cards-panel';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import { listExpenses, listUpcomingExpenses, getExpensesSummary, listExpenseCategories, listCreditCards } from '@/lib/services/expenses';
import { EXPENSE_PAYMENT_STATUS_LABELS, EXPENSE_PAYMENT_METHOD_LABELS } from '@/lib/validation/expenses';

function formatMoney(n: number) {
  return `PHP ${Math.round(n).toLocaleString('en-PH')}`;
}
function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(`${d}T00:00:00`).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    categoryId?: string;
    paymentStatus?: string;
    paymentMethod?: string;
    creditCardId?: string;
    dateFrom?: string;
    dateTo?: string;
    quotationId?: string;
  }>;
}) {
  await requireUser();
  const params = await searchParams;
  const supabase = await createClient();

  const [rows, upcoming, categories, creditCards] = await Promise.all([
    listExpenses(supabase, {
      search: params.search,
      categoryId: params.categoryId,
      paymentStatus: params.paymentStatus,
      paymentMethod: params.paymentMethod,
      creditCardId: params.creditCardId,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      quotationId: params.quotationId,
    }),
    listUpcomingExpenses(supabase),
    listExpenseCategories(supabase),
    listCreditCards(supabase),
  ]);

  const summary = getExpensesSummary(rows);
  const activeCreditCards = creditCards.filter((c) => c.is_active);

  return (
    <>
      <Topbar title="Expenses" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <KpiCard label="Total Expenses" value={formatMoney(summary.totalExpenses)} />
          <KpiCard label="Paid Expenses" value={formatMoney(summary.paidExpenses)} tone="positive" />
          <KpiCard label="Pending Expenses" value={formatMoney(summary.pendingExpenses)} tone="warning" />
          <KpiCard label="This Month" value={formatMoney(summary.thisMonth)} />
          <KpiCard label="Credit Card Expenses" value={formatMoney(summary.creditCardExpenses)} />
          <KpiCard label="Linked Trip Expenses" value={formatMoney(summary.linkedTripExpenses)} />
        </div>

        {params.quotationId && (
          <div className="mb-4 flex items-center justify-between rounded-md border border-harbor-200 bg-harbor-50 px-3 py-2 text-sm text-harbor-700">
            <span>Showing expenses linked to quotation {rows[0]?.quotationNumber ?? params.quotationId}</span>
            <Link href="/expenses" className="font-medium hover:underline">
              Clear
            </Link>
          </div>
        )}

        <div className="mb-4 flex justify-end">
          <AddExpenseButton categories={categories} creditCards={activeCreditCards} />
        </div>

        <form className="mb-4 flex flex-wrap items-center gap-2" action="/expenses">
          <input type="hidden" name="quotationId" value={params.quotationId ?? ''} />
          <input
            type="text"
            name="search"
            defaultValue={params.search}
            placeholder="Search description, customer, or ref…"
            className="w-64 rounded-md border border-sand-200 px-3 py-2 text-sm"
          />
          <AutoSubmitSelect name="categoryId" defaultValue={params.categoryId} placeholder="All categories" options={categories.map((c) => ({ value: c.id, label: c.name }))} />
          <AutoSubmitSelect
            name="paymentStatus"
            defaultValue={params.paymentStatus}
            placeholder="All statuses"
            options={Object.entries(EXPENSE_PAYMENT_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <AutoSubmitSelect
            name="paymentMethod"
            defaultValue={params.paymentMethod}
            placeholder="All methods"
            options={Object.entries(EXPENSE_PAYMENT_METHOD_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <AutoSubmitSelect
            name="creditCardId"
            defaultValue={params.creditCardId}
            placeholder="All cards"
            options={creditCards.map((c) => ({ value: c.id, label: `${c.card_name} •••• ${c.last_four}` }))}
          />
          <span className="text-xs text-ink-500">Date</span>
          <AutoSubmitDateInput name="dateFrom" defaultValue={params.dateFrom} title="From" />
          <AutoSubmitDateInput name="dateTo" defaultValue={params.dateTo} title="To" />
          <button type="submit" className="rounded-md bg-harbor-700 px-3 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600">
            Apply
          </button>
          {(params.search || params.categoryId || params.paymentStatus || params.paymentMethod || params.creditCardId || params.dateFrom || params.dateTo) && (
            <Link href="/expenses" className="text-sm text-ink-500 hover:underline">
              Clear filters
            </Link>
          )}
        </form>

        <ExpensesTable rows={rows} categories={categories} creditCards={activeCreditCards} />

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-700">Upcoming Expenses</h2>
            {upcoming.length === 0 ? (
              <p className="rounded-lg border border-sand-200 bg-surface p-4 text-sm text-ink-500">No upcoming or pending expenses with a due date.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-sand-200 bg-surface">
                <table className="w-full text-sm">
                  <thead className="border-b border-sand-200 bg-sand-50 text-left text-xs font-medium uppercase tracking-wide text-ink-500">
                    <tr>
                      <th className="px-3 py-2">Expense</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2">Due Date</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Method</th>
                      <th className="px-3 py-2">Customer</th>
                      <th className="px-3 py-2">Quotation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sand-100">
                    {upcoming.map((r) => (
                      <tr key={r.id} className="hover:bg-sand-50/60">
                        <td className="px-3 py-2 font-medium text-ink-900">{r.description}</td>
                        <td className="px-3 py-2 text-right font-ticket">{formatMoney(r.amount)}</td>
                        <td className={`px-3 py-2 ${r.daysRemaining < 0 ? 'font-semibold text-coral-600' : 'text-ink-500'}`}>
                          {formatDate(r.dueDate)} {r.daysRemaining < 0 ? `(${Math.abs(r.daysRemaining)}d overdue)` : ''}
                        </td>
                        <td className="px-3 py-2 text-ink-500">{EXPENSE_PAYMENT_STATUS_LABELS[r.paymentStatus as keyof typeof EXPENSE_PAYMENT_STATUS_LABELS]}</td>
                        <td className="px-3 py-2 text-ink-500">{r.creditCardLabel ?? r.paymentMethod.replace('_', ' ')}</td>
                        <td className="px-3 py-2 text-ink-500">
                          {r.clientId ? (
                            <Link href={`/clients/${r.clientId}`} className="text-harbor-700 hover:underline">
                              {r.clientName}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {r.quotationId ? (
                            <Link href={`/quotations/${r.quotationId}`} className="text-harbor-700 hover:underline">
                              {r.quotationNumber}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <CreditCardsPanel cards={creditCards} />
        </div>
      </main>
    </>
  );
}
