'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StatusBadge } from '@/components/ui/status-badge';
import { PIPELINE_STAGE_LABELS, type PipelineStage } from '@/lib/services/pipeline';
import { deleteQuotationsAction } from '@/app/(app)/quotations/actions';

function formatDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}
function formatMoney(n?: number | null) {
  if (n === null || n === undefined) return '—';
  return `PHP ${Math.round(n).toLocaleString('en-PH')}`;
}

export function QuotationsTable({ quotations }: { quotations: any[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const allSelected = quotations.length > 0 && quotations.every((q) => selected.has(q.id));

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (allSelected ? new Set() : new Set(quotations.map((q) => q.id))));
  }

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteQuotationsAction(Array.from(selected));
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
            {selectedCount} quotation{selectedCount !== 1 ? 's' : ''} selected
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

      <table className="w-full text-left text-sm">
        <thead className="border-b border-sand-200 bg-sand-50 text-xs uppercase tracking-wide text-ink-500">
          <tr>
            <th className="w-10 px-4 py-3">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all quotations" />
            </th>
            <th className="px-4 py-3 font-medium">Quotation No.</th>
            <th className="px-4 py-3 font-medium">Client</th>
            <th className="px-4 py-3 font-medium">Destination</th>
            <th className="px-4 py-3 font-medium">Travel dates</th>
            <th className="px-4 py-3 font-medium">Price</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Consultant</th>
            <th className="px-4 py-3 font-medium">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-sand-100">
          {quotations.length === 0 && (
            <tr>
              <td colSpan={9} className="px-4 py-10 text-center text-ink-500">
                No quotations match these filters yet.
              </td>
            </tr>
          )}
          {quotations.map((q) => (
            <tr key={q.id} className="hover:bg-sand-50">
              <td className="px-4 py-3">
                <input type="checkbox" checked={selected.has(q.id)} onChange={() => toggleOne(q.id)} aria-label={`Select ${q.quotation_number}`} />
              </td>
              <td className="px-4 py-3">
                <Link href={`/quotations/${q.id}`} className="font-ticket font-medium text-ink-900 hover:text-harbor-600">
                  {q.quotation_number}
                </Link>
              </td>
              <td className="px-4 py-3 text-ink-700">{q.client?.full_name}</td>
              <td className="px-4 py-3 text-ink-700">{q.current_version?.destination ?? '—'}</td>
              <td className="px-4 py-3 font-ticket text-ink-700">{formatDate(q.current_version?.travel_start_date)}</td>
              <td className="px-4 py-3 font-ticket text-ink-700">{formatMoney(q.current_version?.total_price)}</td>
              <td className="px-4 py-3">
                <StatusBadge label={q.status ? PIPELINE_STAGE_LABELS[q.status as PipelineStage] : 'Draft'} />
              </td>
              <td className="px-4 py-3 text-ink-700">{q.current_version?.consultant_name_snapshot ?? '—'}</td>
              <td className="px-4 py-3 text-ink-500">{formatDate(q.updated_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-surface p-5 shadow-xl">
            <h3 className="font-display text-base font-semibold text-ink-900">
              {selectedCount === 1 ? 'Delete Quotation?' : 'Delete Selected Quotations?'}
            </h3>
            <p className="mt-2 text-sm text-ink-700">
              {selectedCount === 1
                ? 'This quotation will be moved to Deleted Quotations and excluded from active Sales calculations. The quotation data will be retained and can be restored later.'
                : `These ${selectedCount} quotations will be moved to Deleted Quotations and excluded from active Sales calculations. The quotation data will be retained and can be restored later.`}
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
                {isPending ? 'Deleting…' : selectedCount === 1 ? 'Delete Quotation' : 'Delete Selected Quotations'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
