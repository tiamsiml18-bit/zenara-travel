'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { deleteExpenseAction } from '@/app/(app)/expenses/actions';
import { ExpenseForm, type ExpenseFormValues } from './expense-form';
import { EXPENSE_PAYMENT_STATUS_LABELS } from '@/lib/validation/expenses';
import type { ExpenseRow } from '@/lib/services/expenses';

function formatMoney(n: number) {
  return `PHP ${Math.round(n).toLocaleString('en-PH')}`;
}
function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(`${d}T00:00:00`).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

const STATUS_STYLE: Record<string, string> = {
  paid: 'bg-harbor-100 text-harbor-700',
  pending: 'bg-coral-500/10 text-coral-600',
  partially_paid: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
};

export function ExpensesTable({
  rows,
  categories,
  creditCards,
}: {
  rows: ExpenseRow[];
  categories: { id: string; name: string }[];
  creditCards: { id: string; card_name: string; last_four: string }[];
}) {
  const router = useRouter();
  const [editingRow, setEditingRow] = useState<ExpenseRow | null>(null);
  const [, startDeleteTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function handleDelete(row: ExpenseRow) {
    if (!confirm(`Delete "${row.description}"? This cannot be undone.`)) return;
    startDeleteTransition(async () => {
      const result = await deleteExpenseAction(row.id, row.quotationId ?? undefined);
      if (result.ok) router.refresh();
      else setDeleteError(result.error);
    });
  }

  function toFormValues(row: ExpenseRow): ExpenseFormValues {
    return {
      id: row.id,
      expenseDate: row.expenseDate,
      description: row.description,
      categoryId: row.categoryId ?? '',
      amount: row.amount,
      paymentStatus: row.paymentStatus as ExpenseFormValues['paymentStatus'],
      paymentMethod: row.paymentMethod as ExpenseFormValues['paymentMethod'],
      creditCardId: row.creditCardId ?? '',
      dueDate: row.dueDate ?? '',
      clientId: row.clientId ?? '',
      clientName: row.clientName ?? '',
      quotationId: row.quotationId ?? '',
      quotationNumber: row.quotationNumber ?? '',
      bookingId: row.bookingId ?? '',
      bookingNumber: row.bookingNumber ?? '',
      remarks: row.remarks,
    };
  }

  if (rows.length === 0) {
    return <p className="p-6 text-sm text-ink-500">No expenses recorded yet.</p>;
  }

  return (
    <div>
      {editingRow && (
        <ExpenseForm
          initialValues={toFormValues(editingRow)}
          categories={categories}
          creditCards={creditCards}
          onClose={() => {
            setEditingRow(null);
            router.refresh();
          }}
        />
      )}
      {deleteError && (
        <div className="mb-2 rounded-md border border-coral-500/30 bg-coral-500/10 px-3 py-2 text-sm text-coral-600">{deleteError}</div>
      )}
      <div className="overflow-x-auto rounded-lg border border-sand-200 bg-surface">
        <table className="w-full min-w-[1400px] text-sm">
          <thead className="border-b border-sand-200 bg-sand-50 text-left text-xs font-medium uppercase tracking-wide text-ink-500">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2">Payment Status</th>
              <th className="px-3 py-2">Payment Method</th>
              <th className="px-3 py-2">Due Date</th>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Quotation Ref</th>
              <th className="px-3 py-2">Booking</th>
              <th className="px-3 py-2">Remarks</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-sand-50/60">
                <td className="px-3 py-2 text-ink-500">{formatDate(r.expenseDate)}</td>
                <td className="px-3 py-2 font-medium text-ink-900">{r.description}</td>
                <td className="px-3 py-2 text-ink-500">{r.categoryName}</td>
                <td className="px-3 py-2 text-right font-ticket">{formatMoney(r.amount)}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[r.paymentStatus] ?? ''}`}>
                    {EXPENSE_PAYMENT_STATUS_LABELS[r.paymentStatus as keyof typeof EXPENSE_PAYMENT_STATUS_LABELS] ?? r.paymentStatus}
                  </span>
                </td>
                <td className="px-3 py-2 text-ink-500">{r.creditCardLabel ?? r.paymentMethod.replace('_', ' ')}</td>
                <td className="px-3 py-2 text-ink-500">{formatDate(r.dueDate)}</td>
                <td className="px-3 py-2">
                  {r.clientId ? (
                    <Link href={`/clients/${r.clientId}`} className="text-harbor-700 hover:underline">
                      {r.clientName}
                    </Link>
                  ) : (
                    <span className="text-ink-500">—</span>
                  )}
                </td>
                <td className="px-3 py-2 font-medium">
                  {r.quotationId ? (
                    <Link href={`/quotations/${r.quotationId}`} className="text-harbor-700 hover:underline">
                      {r.quotationNumber}
                    </Link>
                  ) : (
                    <span className="text-ink-500">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {r.bookingId ? (
                    <Link href={`/bookings/${r.bookingId}`} className="text-harbor-700 hover:underline">
                      {r.bookingNumber}
                    </Link>
                  ) : (
                    <span className="text-ink-500">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-ink-500">{r.remarks || '—'}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-2 whitespace-nowrap">
                    <button type="button" onClick={() => setEditingRow(r)} className="text-xs font-medium text-harbor-700 hover:underline">
                      Edit
                    </button>
                    <button type="button" onClick={() => handleDelete(r)} className="text-xs font-medium text-coral-600 hover:underline">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
