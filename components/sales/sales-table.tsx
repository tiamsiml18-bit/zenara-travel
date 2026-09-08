'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { updateSalesCostsAction } from '@/app/(app)/sales/actions';
import { SALES_PAYMENT_STATUS_LABELS, type SalesPaymentStatus } from '@/lib/services/sales';

export interface SalesRow {
  bookingId: string;
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
  paymentDueDate: string;
  agentName: string;
  airfareCost: number;
  hotelCost: number;
  transferCost: number;
  tourCost: number;
  bankCharge: number;
  refund: number;
  totalCost: number;
  netProfit: number;
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

/** One editable number cell — local input state so typing doesn't fight the parent's re-render, saved onBlur (not on every keystroke) via the same server action every row shares. Total Cost/Net Profit recalculate immediately on blur, before the server round-trip resolves — an internal-only tracking field doesn't need to make the agent wait to see the number update, and a failed save surfaces as an error rather than silently reverting the visible total. */
function CostCell({
  bookingId,
  field,
  value,
  onSaved,
  onError,
}: {
  bookingId: string;
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
      const result = await updateSalesCostsAction({ bookingId, [field]: parsed });
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

function RemarksCell({ bookingId, value }: { bookingId: string; value: string }) {
  const [draft, setDraft] = useState(value);
  const [isPending, startTransition] = useTransition();

  function save() {
    if (draft === value) return;
    startTransition(async () => {
      await updateSalesCostsAction({ bookingId, remarks: draft });
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

export function SalesTable({ rows }: { rows: SalesRow[] }) {
  // Local copy so Total Cost/Net Profit recalculate immediately on this
  // screen the instant a cost field is saved, without waiting on a full
  // server round-trip + page refresh for every keystroke's blur.
  const [localRows, setLocalRows] = useState(rows);
  const [saveError, setSaveError] = useState<string | null>(null);

  function patchRow(bookingId: string, patch: Record<string, number>) {
    setLocalRows((prev) =>
      prev.map((r) => {
        if (r.bookingId !== bookingId) return r;
        const next = { ...r, ...patch };
        const totalCost = next.airfareCost + next.hotelCost + next.transferCost + next.tourCost + next.bankCharge + next.refund;
        return { ...next, totalCost, netProfit: next.totalSale - totalCost };
      })
    );
  }

  if (localRows.length === 0) {
    return <p className="p-6 text-sm text-ink-500">No sales yet — a quotation appears here once a payment is recorded or its booking is confirmed.</p>;
  }

  return (
    <div>
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
            <th className="px-3 py-2">Agent</th>
            <th className="px-3 py-2">Remarks</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-sand-100">
          {localRows.map((r) => (
            <tr key={r.bookingId} className="hover:bg-sand-50/60">
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
                {r.customerId ? (
                  <Link href={`/clients/${r.customerId}`} className="text-harbor-700 hover:underline">
                    {r.customerName}
                  </Link>
                ) : (
                  r.customerName
                )}
              </td>
              <td className="px-3 py-2 text-ink-500">{formatDate(r.invoiceDate.slice(0, 10))}</td>
              <td className="px-3 py-2 text-ink-500">{formatDate(r.travelStartDate)}</td>
              <td className="px-3 py-2 text-right font-ticket">{formatMoney(r.totalSale)}</td>
              <td className="px-3 py-2 text-right font-ticket">{formatMoney(r.amountPaid)}</td>
              <td className="px-3 py-2 text-right font-ticket">{formatMoney(r.balance)}</td>
              <td className="px-3 py-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[r.paymentStatus]}`}>
                  {SALES_PAYMENT_STATUS_LABELS[r.paymentStatus]}
                </span>
              </td>
              <td className="px-3 py-2 text-right">
                <CostCell bookingId={r.bookingId} field="airfareCost" value={r.airfareCost} onSaved={(p) => patchRow(r.bookingId, p)} onError={setSaveError} />
              </td>
              <td className="px-3 py-2 text-right">
                <CostCell bookingId={r.bookingId} field="hotelCost" value={r.hotelCost} onSaved={(p) => patchRow(r.bookingId, p)} onError={setSaveError} />
              </td>
              <td className="px-3 py-2 text-right">
                <CostCell bookingId={r.bookingId} field="transferCost" value={r.transferCost} onSaved={(p) => patchRow(r.bookingId, p)} onError={setSaveError} />
              </td>
              <td className="px-3 py-2 text-right">
                <CostCell bookingId={r.bookingId} field="tourCost" value={r.tourCost} onSaved={(p) => patchRow(r.bookingId, p)} onError={setSaveError} />
              </td>
              <td className="px-3 py-2 text-right">
                <CostCell bookingId={r.bookingId} field="bankCharge" value={r.bankCharge} onSaved={(p) => patchRow(r.bookingId, p)} onError={setSaveError} />
              </td>
              <td className="px-3 py-2 text-right">
                <CostCell bookingId={r.bookingId} field="refund" value={r.refund} onSaved={(p) => patchRow(r.bookingId, p)} onError={setSaveError} />
              </td>
              <td className="px-3 py-2 text-right font-ticket font-semibold">{formatMoney(r.totalCost)}</td>
              <td className={`px-3 py-2 text-right font-ticket font-semibold ${r.netProfit < 0 ? 'text-coral-600' : 'text-harbor-700'}`}>
                {formatMoney(r.netProfit)}
              </td>
              <td className="px-3 py-2 text-ink-500">{r.paymentStatus === 'paid' ? '—' : formatDate(r.paymentDueDate)}</td>
              <td className="px-3 py-2 text-ink-500">{r.agentName}</td>
              <td className="px-3 py-2">
                <RemarksCell bookingId={r.bookingId} value={r.remarks} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
