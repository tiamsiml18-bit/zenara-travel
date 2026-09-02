'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updatePaymentDetailsAction } from '@/app/(app)/bookings/actions';

export function PaymentDetailsForm({
  bookingId,
  paymentNotes,
  paymentDueDate,
  effectiveDueDate,
  usingDefaultDueDate,
  reminderStopped,
}: {
  bookingId: string;
  paymentNotes: string | null;
  paymentDueDate: string | null;
  effectiveDueDate: string;
  usingDefaultDueDate: boolean;
  reminderStopped: boolean;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(paymentNotes ?? '');
  const [dueDate, setDueDate] = useState(paymentDueDate ?? '');
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  function save(overrides?: { reminderStopped?: boolean }) {
    setMessage(null);
    startTransition(async () => {
      const result = await updatePaymentDetailsAction({
        bookingId,
        paymentNotes: notes,
        paymentDueDate: dueDate,
        reminderStopped: overrides?.reminderStopped,
      });
      if (!result.ok) {
        setMessage({ type: 'error', text: result.error });
        return;
      }
      setMessage({ type: 'success', text: 'Saved.' });
      router.refresh();
    });
  }

  return (
    <section className="rounded-lg border border-sand-200 bg-surface p-5">
      <h3 className="mb-3 font-display text-sm font-semibold text-ink-900">Payment reminder</h3>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-500">Payment due date</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-md border border-sand-200 px-3 py-1.5 text-sm outline-none ring-harbor-400 focus:ring-2"
          />
          <p className="mt-1 text-xs text-ink-500">
            {usingDefaultDueDate
              ? `Using the default — 14 days before travel (${effectiveDueDate}). Set a date above to override.`
              : `Manually set — overrides the 14-days-before-travel default.`}
          </p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-500">Payment notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder='e.g. "Client paid 60% deposit. Remaining 40% due 14 days before departure."'
            className="w-full rounded-md border border-sand-200 px-3 py-2 text-sm outline-none ring-harbor-400 focus:ring-2"
          />
          <p className="mt-1 text-xs text-ink-500">
            Record the actual arrangement here — the reminder always uses the real recorded amount, never an assumed 50/50 split.
          </p>
        </div>

        {message && <p className={`text-xs ${message.type === 'error' ? 'text-coral-600' : 'text-harbor-600'}`}>{message.text}</p>}

        <div className="flex items-center justify-between">
          <button
            type="button"
            disabled={isPending}
            onClick={() => save()}
            className="rounded-md bg-harbor-700 px-4 py-1.5 text-sm font-medium text-sand-50 hover:bg-harbor-600 disabled:opacity-50"
          >
            {isPending ? 'Saving…' : 'Save'}
          </button>

          {reminderStopped ? (
            <span className="text-xs font-medium text-ink-500">Reminders stopped for this booking</span>
          ) : (
            <button
              type="button"
              disabled={isPending}
              onClick={() => save({ reminderStopped: true })}
              className="text-xs font-medium text-coral-600 hover:underline disabled:opacity-50"
            >
              Stop payment reminder
            </button>
          )}
          {reminderStopped && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => save({ reminderStopped: false })}
              className="text-xs font-medium text-harbor-600 hover:underline disabled:opacity-50"
            >
              Resume reminders
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
