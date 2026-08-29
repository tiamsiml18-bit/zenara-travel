'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Briefcase } from 'lucide-react';
import { updateQuotationStatusAction, convertToBookingAction } from '@/app/(app)/bookings/actions';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';

const NEXT_STATUS_OPTIONS: Record<string, { value: string; label: string }[]> = {
  sent: [
    { value: 'negotiating', label: 'Mark as Negotiating' },
    { value: 'confirmed', label: 'Mark as Confirmed' },
    { value: 'lost', label: 'Mark as Lost' },
    { value: 'expired', label: 'Mark as Expired' },
  ],
  viewed: [
    { value: 'negotiating', label: 'Mark as Negotiating' },
    { value: 'confirmed', label: 'Mark as Confirmed' },
    { value: 'lost', label: 'Mark as Lost' },
  ],
  negotiating: [
    { value: 'confirmed', label: 'Mark as Confirmed' },
    { value: 'lost', label: 'Mark as Lost' },
  ],
  follow_up: [
    { value: 'negotiating', label: 'Mark as Negotiating' },
    { value: 'confirmed', label: 'Mark as Confirmed' },
    { value: 'lost', label: 'Mark as Lost' },
  ],
  // Previously missing entirely — a confirmed quotation had no path to
  // Cancelled or Paid in the UI at all.
  confirmed: [
    { value: 'paid', label: 'Mark as Paid' },
    { value: 'cancelled', label: 'Mark as Cancelled' },
  ],
};

// Per the confirmation policy: "Changing a quotation to Confirmed" and
// "Changing a confirmed quotation to Cancelled" are explicitly called out as
// major changes. Other transitions (Negotiating, Lost, Expired, Paid) save
// directly, same as any other status progression.
const MAJOR_TRANSITIONS = new Set(['confirmed', 'cancelled']);

export function QuotationStatusControls({ quotationId, status }: { quotationId: string; status: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { confirm, dialog } = useConfirmDialog();

  const options = NEXT_STATUS_OPTIONS[status] ?? [];
  if (options.length === 0) return null;

  async function handleChange(value: string) {
    if (!value) return;
    setError(null);

    if (MAJOR_TRANSITIONS.has(value)) {
      const label = options.find((o) => o.value === value)?.label ?? 'Update status';
      const ok = await confirm({
        title: `${label}?`,
        description:
          value === 'confirmed'
            ? 'This marks the sale as won and updates the client record accordingly.'
            : 'This marks a confirmed quotation as cancelled.',
        tone: value === 'cancelled' ? 'danger' : 'default',
        confirmLabel: label,
      });
      if (!ok) return;
    }

    startTransition(async () => {
      const result = await updateQuotationStatusAction({ quotationId, status: value });
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <select
        disabled={isPending}
        defaultValue=""
        onChange={(e) => {
          const value = e.target.value;
          handleChange(value);
          e.target.value = ''; // reset so re-selecting the same option still fires onChange
        }}
        className="rounded-md border border-sand-200 px-3 py-2 text-sm"
      >
        <option value="">Update status…</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-coral-600">{error}</p>}
      {dialog}
    </div>
  );
}

export function ConvertToBookingButton({ quotationId }: { quotationId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { confirm, dialog } = useConfirmDialog();

  return (
    <div>
      <button
        type="button"
        disabled={isPending}
        onClick={async () => {
          const ok = await confirm({
            title: 'Convert to booking?',
            description: 'This creates a real booking record and starts payment tracking for this trip.',
            confirmLabel: 'Convert',
          });
          if (!ok) return;
          startTransition(async () => {
            setError(null);
            const result = await convertToBookingAction(quotationId);
            if (!result.ok) return setError(result.error);
            if (result.data) router.push(`/bookings/${result.data.bookingId}`);
          });
        }}
        className="flex items-center gap-1.5 rounded-md bg-harbor-700 px-4 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600 disabled:opacity-60"
      >
        <Briefcase className="h-4 w-4" /> {isPending ? 'Converting…' : 'Convert to booking'}
      </button>
      {error && <p className="mt-1 text-xs text-coral-600">{error}</p>}
      {dialog}
    </div>
  );
}
