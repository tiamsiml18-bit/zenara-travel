'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { togglePackageActiveAction } from '@/app/(app)/packages/actions';

export function ToggleActiveButton({ packageId, isActive }: { packageId: string; isActive: boolean }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await togglePackageActiveAction(packageId, !isActive);
          router.refresh();
        })
      }
      className="text-sm font-medium text-harbor-600 hover:underline disabled:opacity-50"
    >
      {isActive ? 'Deactivate' : 'Activate'}
    </button>
  );
}
