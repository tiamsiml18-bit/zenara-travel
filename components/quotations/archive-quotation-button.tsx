'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Archive } from 'lucide-react';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { archiveQuotationAction } from '@/app/(app)/quotations/actions';

export function ArchiveQuotationButton({ quotationId, quotationNumber }: { quotationId: string; quotationNumber: string }) {
  const { confirm, dialog } = useConfirmDialog();
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <>
      <button
        type="button"
        disabled={isPending}
        title="Archive quotation"
        onClick={async () => {
          const ok = await confirm({
            title: 'Archive this quotation?',
            description: `${quotationNumber} will be hidden from the main quotations list. It isn't deleted — you can find and restore it later.`,
            confirmLabel: 'Archive',
            tone: 'danger',
          });
          if (!ok) return;
          startTransition(async () => {
            const result = await archiveQuotationAction(quotationId);
            if (result.ok) router.push('/quotations');
          });
        }}
        className="flex items-center gap-1.5 rounded-md border border-sand-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-sand-100 disabled:opacity-50"
      >
        <Archive className="h-4 w-4" /> Archive
      </button>
      {dialog}
    </>
  );
}
