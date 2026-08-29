'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Briefcase } from 'lucide-react';
import { updateQuotationStatusAction, convertToBookingAction } from '@/app/(app)/bookings/actions';

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
};

export function QuotationStatusControls({ quotationId, status }: { quotationId: string; status: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const options = NEXT_STATUS_OPTIONS[status] ?? [];
  if (options.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <select
        disabled={isPending}
        defaultValue=""
        onChange={(e) => {
          const value = e.target.value;
          if (!value) return;
          setError(null);
          startTransition(async () => {
            const result = await updateQuotationStatusAction({ quotationId, status: value });
            if (!result.ok) setError(result.error);
            else router.refresh();
          });
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
    </div>
  );
}

export function ConvertToBookingButton({ quotationId }: { quotationId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div>
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await convertToBookingAction(quotationId);
            if (!result.ok) return setError(result.error);
            if (result.data) router.push(`/bookings/${result.data.bookingId}`);
          })
        }
        className="flex items-center gap-1.5 rounded-md bg-harbor-700 px-4 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600 disabled:opacity-60"
      >
        <Briefcase className="h-4 w-4" /> {isPending ? 'Converting…' : 'Convert to booking'}
      </button>
      {error && <p className="mt-1 text-xs text-coral-600">{error}</p>}
    </div>
  );
}
