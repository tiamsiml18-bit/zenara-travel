'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { duplicateTourAction } from '@/app/(app)/tours/actions';

export function DuplicateTourButton({ tourId }: { tourId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await duplicateTourAction(tourId);
          if (result.ok) router.push(`/tours/${result.tourId}`);
        })
      }
      className="text-sm font-medium text-ink-500 hover:text-harbor-600 hover:underline disabled:opacity-50"
    >
      Duplicate
    </button>
  );
}
