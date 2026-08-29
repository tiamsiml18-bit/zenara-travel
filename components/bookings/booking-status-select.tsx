'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateBookingStatusAction } from '@/app/(app)/bookings/actions';
import { BOOKING_STATUSES } from '@/lib/validation/booking';

export function BookingStatusSelect({ bookingId, status }: { bookingId: string; status: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div>
      <select
        disabled={isPending}
        defaultValue={status}
        onChange={(e) => {
          setError(null);
          startTransition(async () => {
            const result = await updateBookingStatusAction({ bookingId, status: e.target.value });
            if (!result.ok) setError(result.error);
            else router.refresh();
          });
        }}
        className="rounded-md border border-sand-200 px-3 py-2 text-sm capitalize"
      >
        {BOOKING_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.replace(/_/g, ' ')}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-coral-600">{error}</p>}
    </div>
  );
}
