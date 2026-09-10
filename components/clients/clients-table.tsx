'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { StatusBadge } from '@/components/ui/status-badge';
import { mergeClientsAction } from '@/app/(app)/clients/actions';

function formatDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}
function formatMoney(n?: number | null) {
  if (n === null || n === undefined) return '—';
  return `PHP ${Math.round(n).toLocaleString('en-PH')}`;
}

export function ClientsTable({ clients, duplicatesView }: { clients: any[]; duplicatesView: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [survivingId, setSurvivingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return prev; // merge is pairwise — a third click just doesn't register until one is deselected
      return [...prev, id];
    });
  }

  function openMergeDialog() {
    setSurvivingId(selected[0] ?? null);
    setConfirming(true);
  }

  function handleMerge() {
    if (!survivingId || selected.length !== 2) return;
    const duplicateId = selected.find((id) => id !== survivingId);
    if (!duplicateId) return;
    setError(null);
    startTransition(async () => {
      const result = await mergeClientsAction(survivingId, duplicateId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSelected([]);
      setConfirming(false);
      router.refresh();
    });
  }

  const selectedClients = clients.filter((c) => selected.includes(c.id));

  return (
    <div className="overflow-hidden rounded-lg border border-sand-200 bg-surface">
      {duplicatesView && selected.length > 0 && (
        <div className="flex items-center justify-between border-b border-sand-200 bg-sand-50 px-4 py-2.5">
          <span className="text-sm text-ink-700">
            {selected.length} of 2 selected {selected.length < 2 && '— pick one more client to merge'}
          </span>
          <button
            type="button"
            onClick={openMergeDialog}
            disabled={selected.length !== 2}
            className="rounded-md bg-harbor-700 px-3 py-1.5 text-sm font-medium text-sand-50 hover:bg-harbor-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Merge Selected
          </button>
        </div>
      )}

      <table className="w-full text-left text-sm">
        <thead className="border-b border-sand-200 bg-sand-50 text-xs uppercase tracking-wide text-ink-500">
          <tr>
            {duplicatesView && <th className="w-10 px-4 py-3" />}
            <th className="px-4 py-3 font-medium">Client</th>
            <th className="px-4 py-3 font-medium">Destination</th>
            <th className="px-4 py-3 font-medium">Travel date</th>
            <th className="px-4 py-3 font-medium">Quoted price</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Agent</th>
            <th className="px-4 py-3 font-medium">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-sand-100">
          {clients.length === 0 && (
            <tr>
              <td colSpan={duplicatesView ? 8 : 7} className="px-4 py-10 text-center text-ink-500">
                {duplicatesView ? 'No possible duplicate clients found.' : 'No clients match these filters yet.'}
              </td>
            </tr>
          )}
          {clients.map((c) => (
            <tr key={c.id} className="hover:bg-sand-50">
              {duplicatesView && (
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.includes(c.id)}
                    onChange={() => toggle(c.id)}
                    aria-label={`Select ${c.full_name}`}
                  />
                </td>
              )}
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Link href={`/clients/${c.id}`} className="font-medium text-ink-900 hover:text-harbor-600">
                    {c.full_name}
                  </Link>
                  {c.isPossibleDuplicate && !duplicatesView && (
                    <span className="rounded-full bg-sand-200 px-2 py-0.5 text-[11px] font-medium text-ink-600">
                      Possible Duplicate
                    </span>
                  )}
                </div>
                <p className="text-xs text-ink-500">{c.email || c.mobile_number || '—'}</p>
              </td>
              <td className="px-4 py-3 text-ink-700">{c.destination || '—'}</td>
              <td className="px-4 py-3 font-ticket text-ink-700">{formatDate(c.travel_start_date)}</td>
              <td className="px-4 py-3 font-ticket text-ink-700">{formatMoney(c.quoted_price)}</td>
              <td className="px-4 py-3">{c.status && <StatusBadge label={c.status.name} />}</td>
              <td className="px-4 py-3 text-ink-700">{c.agent?.full_name ?? '—'}</td>
              <td className="px-4 py-3 text-ink-500">{formatDate(c.updated_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {confirming && selectedClients.length === 2 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-surface p-5 shadow-xl">
            <h3 className="font-display text-base font-semibold text-ink-900">Merge Duplicate Clients?</h3>
            <p className="mt-1.5 text-sm text-ink-500">
              This will combine the selected client records into one client. All related quotations, bookings,
              sales, payments, and other records will be retained.
            </p>

            <p className="mt-4 mb-2 text-xs font-medium uppercase tracking-wide text-ink-500">
              Which record should remain as the primary client?
            </p>
            <div className="space-y-2">
              {selectedClients.map((c) => (
                <label
                  key={c.id}
                  className={`flex cursor-pointer items-start gap-2.5 rounded-md border p-3 ${
                    survivingId === c.id ? 'border-harbor-500 bg-harbor-500/5' : 'border-sand-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="surviving"
                    checked={survivingId === c.id}
                    onChange={() => setSurvivingId(c.id)}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium text-ink-900">{c.full_name}</p>
                    <p className="text-xs text-ink-500">
                      {c.email || '—'} &middot; {c.mobile_number || '—'}
                    </p>
                  </div>
                </label>
              ))}
            </div>

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
                onClick={handleMerge}
                disabled={isPending || !survivingId}
                className="rounded-md bg-harbor-700 px-4 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600 disabled:opacity-60"
              >
                {isPending ? 'Merging…' : 'Merge Clients'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
