'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Briefcase } from 'lucide-react';
import { updateQuotationStatusAction, convertToBookingAction } from '@/app/(app)/bookings/actions';
import type { PipelineStage } from '@/lib/services/pipeline';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';

// The same six stages Follow-up (pipeline) status uses — Quotation Status
// and Follow-up Status are now one consistent system, not two vocabularies
// that happen to look similar. Changing either one here moves both
// together (see updateQuotationStatus).
const NEXT_STATUS_OPTIONS: Record<string, { value: string; label: string }[]> = {
  sent: [
    { value: 'negotiating', label: 'Mark as Negotiating' },
    { value: 'confirmed', label: 'Mark as Confirmed' },
    { value: 'no_response', label: 'Mark as No Response' },
    { value: 'lost', label: 'Mark as Lost' },
  ],
  negotiating: [
    { value: 'confirmed', label: 'Mark as Confirmed' },
    { value: 'no_response', label: 'Mark as No Response' },
    { value: 'lost', label: 'Mark as Lost' },
  ],
  confirmed: [
    { value: 'paid', label: 'Mark as Paid' },
    // Covers what "Cancelled" used to mean — a confirmed booking that
    // falls through is Lost, same as any other client who's no longer
    // proceeding, per the unified six-stage vocabulary.
    { value: 'lost', label: 'Mark as Lost' },
  ],
  no_response: [
    { value: 'negotiating', label: 'Mark as Negotiating' },
    { value: 'lost', label: 'Mark as Lost' },
  ],
};

// Per the confirmation policy: moving TO Confirmed, and moving a confirmed
// quotation to Lost (covering what "Cancelled" used to mean), are major
// changes. Other transitions save directly, same as any other status
// progression.
const MAJOR_TRANSITIONS = new Set(['confirmed']);

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

    const isCancellingConfirmed = status === 'confirmed' && value === 'lost';
    if (MAJOR_TRANSITIONS.has(value) || isCancellingConfirmed) {
      const label = options.find((o) => o.value === value)?.label ?? 'Update status';
      const ok = await confirm({
        title: `${label}?`,
        description:
          value === 'confirmed'
            ? 'This marks the sale as won and updates the client record accordingly.'
            : 'This marks a confirmed booking as lost.',
        tone: isCancellingConfirmed ? 'danger' : 'default',
        confirmLabel: label,
      });
      if (!ok) return;
    }

    startTransition(async () => {
      const result = await updateQuotationStatusAction({ quotationId, status: value as PipelineStage });
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
