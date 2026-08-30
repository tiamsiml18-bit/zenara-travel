'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setTourActiveAction } from '@/app/(app)/tours/actions';

export function ToggleTourActiveButton({ tourId, isActive }: { tourId: string; isActive: boolean }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await setTourActiveAction(tourId, !isActive);
          router.refresh();
        })
      }
      className="text-sm font-medium text-harbor-600 hover:underline disabled:opacity-50"
    >
      {isActive ? 'Archive' : 'Activate'}
    </button>
  );
}
