'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { updateSalesCostsAction, updateHistoricalSaleFieldAction, deleteHistoricalSaleAction } from '@/app/(app)/sales/actions';
import { updateCostSourceAction } from '@/app/(app)/expenses/actions';
import { SALES_PAYMENT_STATUS_LABELS, type SalesPaymentStatus } from '@/lib/services/sales';
import { HistoricalSaleForm, type HistoricalSaleFormValues } from './historical-sale-form';

/**
 * One row for the unified Sales table — either a CRM (bookings-based) row
 * or a Historical Sales row, distinguished by dataSource. Deliberately a
 * superset of the original CRM-only shape (bookingId is still exactly
 * what it always was) rather than a rename, so nothing that already
 * builds a CRM row needs to change.
 */
export interface SalesRow {
  dataSource: 'crm' | 'historical';
  bookingId?: string;
  historicalId?: string;
  // Only meaningful for CRM rows — which cost figures are actually
  // driving Total Cost/Net Profit for this booking. Historical rows have
  // no Expenses concept at all, so this is always 'manual' for them.
  costSource?: 'manual' | 'linked_expenses';
  quotationId: string | null;
  quotationNumber: string;
  customerId: string | null;
  customerName: string;
  invoiceDate: string;
  travelStartDate: string;
  totalSale: number;
  amountPaid: number;
  balance: number;
  paymentStatus: SalesPaymentStatus;
  paymentDueDate: string | null;
  agentName: string;
  airfareCost: number;
  hotelCost: number;
  transferCost: number;
  tourCost: number;
  bankCharge: number;
  refund: number;
  totalCost: number;
  netProfit: number;
  zohoInvoiceNumber: string;
  remarks: string;
}

function formatMoney(n: number) {
  return `PHP ${Math.round(n).toLocaleString('en-PH')}`;
}
function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(`${d}T00:00:00`).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

const STATUS_STYLE: Record<SalesPaymentStatus, string> = {
  pending_payment: 'bg-coral-500/10 text-coral-600',
  partially_paid: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  paid: 'bg-harbor-100 text-harbor-700',
  confirmed: 'bg-sand-100 text-ink-700',
};

/**
 * Routes an inline field save to the correct existing server action for
 * this row's source — CRM rows keep using updateSalesCostsAction exactly
 * as before; Historical rows use the separate, dedicated historical
 * action. Nothing about how CRM Sales saves changed.
 */
async function saveRowField(row: SalesRow, patch: Record<string, number | string>) {
  if (row.dataSource === 'crm') {
    return updateSalesCostsAction({ bookingId: row.bookingId!, ...patch });
  }
  return updateHistoricalSaleFieldAction(row.historicalId!, patch);
}

/** One editable number cell — local input state so typing doesn't fight the parent's re-render, saved onBlur (not on every keystroke). Total Cost/Net Profit recalculate immediately on blur, before the server round-trip resolves — an internal-only tracking field doesn't need to make the agent wait to see the number update, and a failed save surfaces as an error rather than silently reverting the visible total. */
function CostCell({
  row,
  field,
  value,
  onSaved,
  onError,
}: {
  row: SalesRow;
  field: string;
  value: number;
  onSaved: (patch: Record<string, number>) => void;
  onError: (message: string) => void;
}) {
  const [draft, setDraft] = useState(String(Math.round(value)));
  const [isPending, startTransition] = useTransition();

  function save() {
    const parsed = draft === '' ? 0 : Number(draft);
    if (Number.isNaN(parsed) || parsed === value) return;
    onSaved({ [field]: parsed });
    startTransition(async () => {
      const result = await saveRowField(row, { [field]: parsed });
      if (!result.ok) onError(result.error);
    });
  }

  return (
    <input
      type="number"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={save}
      disabled={isPending}
      className="w-24 rounded border border-transparent bg-transparent px-1.5 py-1 text-right text-sm hover:border-sand-200 focus:border-harbor-400 focus:bg-surface focus:outline-none disabled:opacity-60"
    />
  );
}

function RemarksCell({ row, value }: { row: SalesRow; value: string }) {
  const [draft, setDraft] = useState(value);
  const [isPending, startTransition] = useTransition();

  function save() {
    if (draft === value) return;
    startTransition(async () => {
      await saveRowField(row, { remarks: draft });
    });
  }

  return (
    <input
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={save}
      disabled={isPending}
      placeholder="Remarks…"
      className="w-32 rounded border border-transparent bg-transparent px-1.5 py-1 text-sm hover:border-sand-200 focus:border-harbor-400 focus:bg-surface focus:outline-none disabled:opacity-60"
    />
  );
}

/** Purely an internal accounting reference — manually entered, saved alongside the existing cost fields, never affects Total Cost/Net Profit or any calculation. Works for both CRM and Historical rows via the same saveRowField routing every other inline-editable cell already uses. */
function ZohoInvoiceCell({ row, value }: { row: SalesRow; value: string }) {
  const [draft, setDraft] = useState(value);
  const [isPending, startTransition] = useTransition();

  function save() {
    if (draft === value) return;
    startTransition(async () => {
      await saveRowField(row, { zohoInvoiceNumber: draft });
    });
  }

  return (
    <input
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={save}
      disabled={isPending}
      placeholder="Zoho Invoice #…"
      className="w-28 rounded border border-transparent bg-transparent px-1.5 py-1 text-sm hover:border-sand-200 focus:border-harbor-400 focus:bg-surface focus:outline-none disabled:opacity-60"
    />
  );
}

/**
 * The one control point for switching a CRM Sales row between the
 * existing manual cost fields and the sum of that row's linked Expenses.
 * Deliberately a plain <select>, not a toggle that silently recalculates
 * anything on its own — changing it only changes which number Total
 * Cost/Net Profit read from; it never edits or clears the other source's
 * values, so switching back to Manual finds the agent's previous entries
 * untouched.
 */
function CostSourceSelect({ bookingId, value }: { bookingId: string; value: 'manual' | 'linked_expenses' }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleChange(next: 'manual' | 'linked_expenses') {
    startTransition(async () => {
      const result = await updateCostSourceAction({ bookingId, costSource: next });
      if (result.ok) router.refresh();
    });
  }

  return (
    <select
      value={value}
      disabled={isPending}
      onChange={(e) => handleChange(e.target.value as 'manual' | 'linked_expenses')}
      className="rounded border border-sand-200 bg-transparent px-1.5 py-1 text-xs disabled:opacity-60"
    >
      <option value="manual">Manual</option>
      <option value="linked_expenses">Linked Expenses</option>
    </select>
  );
}

export function SalesTable({ rows }: { rows: SalesRow[] }) {
  const router = useRouter();
  // Local copy so Total Cost/Net Profit recalculate immediately on this
  // screen the instant a cost field is saved, without waiting on a full
  // server round-trip + page refresh for every keystroke's blur.
  const [localRows, setLocalRows] = useState(rows);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<SalesRow | null>(null);
  const [, startDeleteTransition] = useTransition();

  const rowKey = (r: SalesRow) => (r.dataSource === 'crm' ? `crm-${r.bookingId}` : `hist-${r.historicalId}`);

  function patchRow(key: string, patch: Record<string, number>) {
    setLocalRows((prev) =>
      prev.map((r) => {
        if (rowKey(r) !== key) return r;
        const next = { ...r, ...patch };
        const totalCost = next.airfareCost + next.hotelCost + next.transferCost + next.tourCost + next.bankCharge + next.refund;
        return { ...next, totalCost, netProfit: next.totalSale - totalCost };
      })
    );
  }

  function handleDelete(row: SalesRow) {
    if (!row.historicalId) return;
    if (!confirm(`Delete this historical sale for ${row.customerName}? This cannot be undone.`)) return;
    startDeleteTransition(async () => {
      const result = await deleteHistoricalSaleAction(row.historicalId!);
      if (result.ok) {
        setLocalRows((prev) => prev.filter((r) => rowKey(r) !== rowKey(row)));
      } else {
        setSaveError(result.error);
      }
    });
  }

  function toFormValues(row: SalesRow): HistoricalSaleFormValues {
    return {
      id: row.historicalId,
      quotationRef: row.quotationNumber === '—' ? '' : row.quotationNumber,
      customerName: row.customerName,
      invoiceDate: row.invoiceDate ? row.invoiceDate.slice(0, 10) : '',
      travelDate: row.travelStartDate ?? '',
      totalSale: row.totalSale,
      amountPaid: row.amountPaid,
      paymentStatus: row.paymentStatus,
      airfareCost: row.airfareCost,
      hotelCost: row.hotelCost,
      transferCost: row.transferCost,
      tourCost: row.tourCost,
      bankCharge: row.bankCharge,
      refund: row.refund,
      agentName: row.agentName === '—' ? '' : row.agentName,
      zohoInvoiceNumber: row.zohoInvoiceNumber,
      remarks: row.remarks,
    };
  }

  if (localRows.length === 0) {
    return <p className="p-6 text-sm text-ink-500">No sales yet — a quotation appears here once a payment is recorded or its booking is confirmed.</p>;
  }

  return (
    <div>
      {editingRow && (
        <HistoricalSaleForm
          initialValues={toFormValues(editingRow)}
          onClose={() => {
            setEditingRow(null);
            router.refresh();
          }}
        />
      )}
      {saveError && (
        <div className="mb-2 rounded-md border border-coral-500/30 bg-coral-500/10 px-3 py-2 text-sm text-coral-600">
          {saveError}{' '}
          <button type="button" onClick={() => setSaveError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-sand-200 bg-surface">
        <table className="w-full min-w-[1900px] text-sm">
          <thead className="border-b border-sand-200 bg-sand-50 text-left text-xs font-medium uppercase tracking-wide text-ink-500">
            <tr>
              <th className="px-3 py-2">Quotation Ref</th>
              <th className="px-3 py-2">Zoho Invoice #</th>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Invoice Date</th>
              <th className="px-3 py-2">Travel Date</th>
              <th className="px-3 py-2 text-right">Total Sale</th>
              <th className="px-3 py-2 text-right">Amount Paid</th>
              <th className="px-3 py-2 text-right">Balance</th>
              <th className="px-3 py-2">Payment Status</th>
              <th className="px-3 py-2 text-right">Airfare Cost</th>
              <th className="px-3 py-2 text-right">Hotel Cost</th>
              <th className="px-3 py-2 text-right">Airport Transfer</th>
              <th className="px-3 py-2 text-right">Tour Package</th>
              <th className="px-3 py-2 text-right">Bank Charge</th>
              <th className="px-3 py-2 text-right">Refund</th>
              <th className="px-3 py-2 text-right">Total Cost</th>
              <th className="px-3 py-2 text-right">Net Profit</th>
              <th className="px-3 py-2">Next Payment Due</th>
              <th className="px-3 py-2">Remarks</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-100">
            {localRows.map((r) => {
              const key = rowKey(r);
              return (
                <tr key={key} className="hover:bg-sand-50/60">
                  <td className="px-3 py-2 font-medium">
                    {r.quotationId ? (
                      <Link href={`/quotations/${r.quotationId}`} className="text-harbor-700 hover:underline">
                        {r.quotationNumber}
                      </Link>
                    ) : (
                      r.quotationNumber
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <ZohoInvoiceCell row={r} value={r.zohoInvoiceNumber} />
                  </td>
                  <td className="px-3 py-2">
                    {r.customerId ? (
                      <Link href={`/clients/${r.customerId}`} className="text-harbor-700 hover:underline">
                        {r.customerName}
                      </Link>
                    ) : (
                      r.customerName
                    )}
                  </td>
                  <td className="px-3 py-2 text-ink-500">{formatDate(r.invoiceDate ? r.invoiceDate.slice(0, 10) : null)}</td>
                  <td className="px-3 py-2 text-ink-500">{formatDate(r.travelStartDate || null)}</td>
                  <td className="px-3 py-2 text-right font-ticket">{formatMoney(r.totalSale)}</td>
                  <td className="px-3 py-2 text-right font-ticket">{formatMoney(r.amountPaid)}</td>
                  <td className="px-3 py-2 text-right font-ticket">{formatMoney(r.balance)}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[r.paymentStatus]}`}>
                      {SALES_PAYMENT_STATUS_LABELS[r.paymentStatus]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <CostCell row={r} field="airfareCost" value={r.airfareCost} onSaved={(p) => patchRow(key, p)} onError={setSaveError} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <CostCell row={r} field="hotelCost" value={r.hotelCost} onSaved={(p) => patchRow(key, p)} onError={setSaveError} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <CostCell row={r} field="transferCost" value={r.transferCost} onSaved={(p) => patchRow(key, p)} onError={setSaveError} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <CostCell row={r} field="tourCost" value={r.tourCost} onSaved={(p) => patchRow(key, p)} onError={setSaveError} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <CostCell row={r} field="bankCharge" value={r.bankCharge} onSaved={(p) => patchRow(key, p)} onError={setSaveError} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <CostCell row={r} field="refund" value={r.refund} onSaved={(p) => patchRow(key, p)} onError={setSaveError} />
                  </td>
                  <td className="px-3 py-2 text-right font-ticket font-semibold">{formatMoney(r.totalCost)}</td>
                  <td className={`px-3 py-2 text-right font-ticket font-semibold ${r.netProfit < 0 ? 'text-coral-600' : 'text-harbor-700'}`}>
                    {formatMoney(r.netProfit)}
                  </td>
                  <td className="px-3 py-2 text-ink-500">{r.paymentStatus === 'paid' ? '—' : formatDate(r.paymentDueDate)}</td>
                  <td className="px-3 py-2">
                    <RemarksCell row={r} value={r.remarks} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2 whitespace-nowrap">
                      {r.dataSource === 'crm' && r.quotationId && (
                        <Link href={`/expenses?quotationId=${r.quotationId}`} className="text-xs font-medium text-harbor-700 hover:underline">
                          View Expenses
                        </Link>
                      )}
                      {r.dataSource === 'historical' && (
                        <>
                          <button type="button" onClick={() => setEditingRow(r)} className="text-xs font-medium text-harbor-700 hover:underline">
                            Edit
                          </button>
                          <button type="button" onClick={() => handleDelete(r)} className="text-xs font-medium text-coral-600 hover:underline">
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
