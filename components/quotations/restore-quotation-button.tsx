'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { restoreQuotationAction } from '@/app/(app)/quotations/actions';

export function RestoreQuotationButton({ quotationId, quotationNumber }: { quotationId: string; quotationNumber: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRestore() {
    setError(null);
    startTransition(async () => {
      const result = await restoreQuotationAction(quotationId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setConfirming(false);
      router.refresh();
    });
  }

  return (
    <>
      <button type="button" onClick={() => setConfirming(true)} className="text-sm font-medium text-harbor-700 hover:underline">
        Restore
      </button>
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-surface p-5 shadow-xl">
            <h3 className="font-display text-base font-semibold text-ink-900">Restore this quotation?</h3>
            <p className="mt-2 text-sm text-ink-700">
              This quotation will return to the active Quotations list with all of its existing data.
            </p>
            <p className="mt-1 text-xs text-ink-500">{quotationNumber}</p>
            {error && <div className="mt-3 rounded-md border border-coral-500/30 bg-coral-500/5 px-3 py-2 text-sm text-coral-600">{error}</div>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={isPending}
                className="rounded-md border border-sand-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-sand-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRestore}
                disabled={isPending}
                className="rounded-md bg-harbor-700 px-4 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600 disabled:opacity-60"
              >
                {isPending ? 'Restoring…' : 'Restore Quotation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
