'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendQuotationAction, duplicateQuotationAction } from '@/app/(app)/quotations/actions';

export function SendQuotationButton({ quotationId, disabled }: { quotationId: string; disabled?: boolean }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={disabled || isPending}
      onClick={() => {
        if (!confirm('Mark this quotation as sent? Once sent, this version can no longer be edited \u2014 any change will create a new revision.')) return;
        startTransition(async () => {
          await sendQuotationAction(quotationId);
          router.refresh();
        });
      }}
      className="rounded-md bg-harbor-700 px-4 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600 disabled:opacity-40"
    >
      {isPending ? 'Sending\u2026' : 'Mark as sent'}
    </button>
  );
}

export function DuplicateQuotationButton({ quotationId }: { quotationId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            const result = await duplicateQuotationAction(quotationId);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            router.push(`/quotations/${result.quotationId}`);
          });
        }}
        className="rounded-md border border-sand-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-sand-100 disabled:opacity-40"
      >
        {isPending ? 'Duplicating\u2026' : 'Duplicate'}
      </button>
      {error && <p className="mt-1 text-xs text-coral-600">{error}</p>}
    </div>
  );
}
