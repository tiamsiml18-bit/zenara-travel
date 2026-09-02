'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addPaymentAction } from '@/app/(app)/bookings/actions';
import { PAYMENT_METHODS } from '@/lib/validation/booking';

export function AddPaymentForm({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<string>(PAYMENT_METHODS[0]);
  const [notes, setNotes] = useState('');

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await addPaymentAction({
        bookingId,
        amount: Number(amount),
        paymentDate,
        method,
        notes,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAmount('');
      setNotes('');
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-sand-200 bg-surface p-4">
      <h3 className="mb-3 font-display text-sm font-semibold text-ink-900">Record a payment</h3>
      {error && <p className="mb-2 text-xs text-coral-600">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          placeholder="Amount (PHP)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="rounded-md border border-sand-200 px-2.5 py-1.5 text-sm"
        />
        <input
          type="date"
          value={paymentDate}
          onChange={(e) => setPaymentDate(e.target.value)}
          className="rounded-md border border-sand-200 px-2.5 py-1.5 text-sm"
        />
        <select value={method} onChange={(e) => setMethod(e.target.value)} className="rounded-md border border-sand-200 px-2.5 py-1.5 text-sm">
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="rounded-md border border-sand-200 px-2.5 py-1.5 text-sm"
        />
      </div>
      <button
        type="button"
        disabled={isPending || !amount}
        onClick={handleSubmit}
        className="mt-3 w-full rounded-md bg-harbor-700 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600 disabled:opacity-60"
      >
        {isPending ? 'Saving…' : 'Add payment'}
      </button>
    </div>
  );
}
