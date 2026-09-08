'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateRecurringStatusAction } from '@/app/(app)/expenses/actions';
import { RECURRING_FREQUENCY_LABELS, RECURRING_STATUS_LABELS, type RecurringFrequency, type RecurringStatus } from '@/lib/validation/expenses';

function formatMoney(n: number) {
  return `PHP ${Math.round(n).toLocaleString('en-PH')}`;
}
function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(`${d}T00:00:00`).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

export interface RecurringScheduleRow {
  id: string;
  description: string;
  amount: number;
  frequency: RecurringFrequency;
  startDate: string;
  endDate: string | null;
  status: RecurringStatus;
  nextDueDate: string | null;
}

const STATUS_STYLE: Record<RecurringStatus, string> = {
  active: 'bg-harbor-100 text-harbor-700',
  paused: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  ended: 'bg-sand-100 text-ink-500',
};

export function RecurringExpensesSection({ schedules }: { schedules: RecurringScheduleRow[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function setStatus(id: string, status: RecurringStatus) {
    startTransition(async () => {
      const result = await updateRecurringStatusAction({ id, status });
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  return (
    <div className="mt-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-700">Recurring Expenses</h2>
      {error && <div className="mb-2 rounded-md border border-coral-500/30 bg-coral-500/10 px-3 py-2 text-sm text-coral-600">{error}</div>}
      {schedules.length === 0 ? (
        <p className="rounded-lg border border-sand-200 bg-surface p-4 text-sm text-ink-500">
          No recurring expenses yet — check &quot;Make this a recurring expense&quot; when adding one.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-sand-200 bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-sand-200 bg-sand-50 text-left text-xs font-medium uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2">Frequency</th>
                <th className="px-3 py-2">Start Date</th>
                <th className="px-3 py-2">End Date</th>
                <th className="px-3 py-2">Next Due</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {schedules.map((s) => (
                <tr key={s.id} className="hover:bg-sand-50/60">
                  <td className="px-3 py-2 font-medium text-ink-900">{s.description}</td>
                  <td className="px-3 py-2 text-right font-ticket">{formatMoney(s.amount)}</td>
                  <td className="px-3 py-2 text-ink-500">{RECURRING_FREQUENCY_LABELS[s.frequency]}</td>
                  <td className="px-3 py-2 text-ink-500">{formatDate(s.startDate)}</td>
                  <td className="px-3 py-2 text-ink-500">{formatDate(s.endDate)}</td>
                  <td className="px-3 py-2 text-ink-500">{s.status === 'active' ? formatDate(s.nextDueDate) : '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[s.status]}`}>{RECURRING_STATUS_LABELS[s.status]}</span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2 whitespace-nowrap">
                      {s.status === 'active' && (
                        <button type="button" onClick={() => setStatus(s.id, 'paused')} className="text-xs font-medium text-amber-700 hover:underline">
                          Pause
                        </button>
                      )}
                      {s.status === 'paused' && (
                        <button type="button" onClick={() => setStatus(s.id, 'active')} className="text-xs font-medium text-harbor-700 hover:underline">
                          Resume
                        </button>
                      )}
                      {s.status !== 'ended' && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Stop the recurring "${s.description}" schedule? Already-generated expenses are kept.`)) setStatus(s.id, 'ended');
                          }}
                          className="text-xs font-medium text-coral-600 hover:underline"
                        >
                          Stop
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
