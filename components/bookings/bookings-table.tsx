'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StatusBadge } from '@/components/ui/status-badge';
import { deleteBookingsAction } from '@/app/(app)/bookings/actions';

function formatDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}
function formatMoney(n?: number | null) {
  if (n === null || n === undefined) return '—';
  return `PHP ${Math.round(n).toLocaleString('en-PH')}`;
}

const PAYMENT_STATUS_STYLE: Record<string, string> = {
  unpaid: 'bg-coral-500/10 text-coral-600',
  partial: 'bg-warning-100 text-warning-700',
  paid: 'bg-harbor-100 text-harbor-700',
  refunded: 'bg-sand-100 text-ink-500',
};

export function BookingsTable({ bookings }: { bookings: any[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const allSelected = bookings.length > 0 && bookings.every((b) => selected.has(b.id));

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (allSelected ? new Set() : new Set(bookings.map((b) => b.id))));
  }

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteBookingsAction(Array.from(selected));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSelected(new Set());
      setConfirming(false);
      router.refresh();
    });
  }

  const selectedCount = selected.size;

  return (
    <div className="overflow-hidden rounded-lg border border-sand-200 bg-surface">
      {selectedCount > 0 && (
        <div className="flex items-center justify-between border-b border-sand-200 bg-sand-50 px-4 py-2.5">
          <span className="text-sm text-ink-700">
            {selectedCount} booking{selectedCount !== 1 ? 's' : ''} selected
          </span>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded-md bg-coral-600 px-3 py-1.5 text-sm font-medium text-sand-50 hover:bg-coral-700"
          >
            Delete Selected
          </button>
        </div>
      )}

      <table className="w-full text-sm">
        <thead className="border-b border-sand-200 bg-sand-50 text-left text-xs font-medium uppercase tracking-wide text-ink-500">
          <tr>
            <th className="w-10 px-4 py-3">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all bookings" />
            </th>
            <th className="px-4 py-3">Booking</th>
            <th className="px-4 py-3">Client</th>
            <th className="px-4 py-3">Destination</th>
            <th className="px-4 py-3">Travel dates</th>
            <th className="px-4 py-3 text-right">Total</th>
            <th className="px-4 py-3">Payment</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((b) => (
            <tr key={b.id} className="border-b border-sand-100 last:border-0 hover:bg-sand-50/50">
              <td className="px-4 py-3">
                <input type="checkbox" checked={selected.has(b.id)} onChange={() => toggleOne(b.id)} aria-label={`Select ${b.booking_number}`} />
              </td>
              <td className="px-4 py-3">
                <Link href={`/bookings/${b.id}`} className="font-ticket font-medium text-ink-900 hover:text-harbor-600">
                  {b.booking_number}
                </Link>
                <p className="text-xs text-ink-500">{b.quotation?.quotation_number}</p>
              </td>
              <td className="px-4 py-3 text-ink-700">{b.client?.full_name}</td>
              <td className="px-4 py-3 text-ink-700">{b.destination}</td>
              <td className="px-4 py-3 text-ink-700">
                {formatDate(b.travel_start_date)} – {formatDate(b.travel_end_date)}
              </td>
              <td className="font-ticket px-4 py-3 text-right text-ink-900">{formatMoney(b.total_amount)}</td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${PAYMENT_STATUS_STYLE[b.payment_status] ?? ''}`}>
                  {b.payment_status}
                </span>
              </td>
              <td className="px-4 py-3">
                <StatusBadge label={b.status} />
              </td>
            </tr>
          ))}
          {bookings.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-10 text-center text-ink-500">
                No bookings yet — confirmed quotations can be converted from the quotation page.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-surface p-5 shadow-xl">
            <h3 className="font-display text-base font-semibold text-ink-900">
              {selectedCount === 1 ? 'Delete Booking?' : 'Delete Selected Bookings?'}
            </h3>
            <p className="mt-2 text-sm text-ink-700">
              {selectedCount === 1
                ? 'This booking record will be permanently deleted from Bookings, Sales, and Reports. The related client, quotation, and payment records are not affected.'
                : `These ${selectedCount} booking records will be permanently deleted from Bookings, Sales, and Reports. The related clients, quotations, and payment records are not affected.`}
            </p>
            {error && <div className="mt-3 rounded-md border border-coral-500/30 bg-coral-500/5 px-3 py-2 text-sm text-coral-600">{error}</div>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={isPending}
                className="rounded-md border border-sand-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-sand-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="rounded-md bg-coral-600 px-4 py-2 text-sm font-medium text-sand-50 hover:bg-coral-700 disabled:opacity-60"
              >
                {isPending ? 'Deleting…' : selectedCount === 1 ? 'Delete Booking' : 'Delete Selected Bookings'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
