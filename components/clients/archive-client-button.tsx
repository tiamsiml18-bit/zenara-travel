'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Archive } from 'lucide-react';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { archiveClientAction } from '@/app/(app)/clients/actions';

export function ArchiveClientButton({ clientId, clientName }: { clientId: string; clientName: string }) {
  const { confirm, dialog } = useConfirmDialog();
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <>
      <button
        type="button"
        title="Archive client"
        disabled={isPending}
        onClick={async () => {
          const ok = await confirm({
            title: 'Archive this client?',
            description: `${clientName} will be removed from your active client list. This doesn't delete their history — you can restore them later if needed.`,
            confirmLabel: 'Archive',
            tone: 'danger',
          });
          if (!ok) return;
          startTransition(async () => {
            const result = await archiveClientAction(clientId);
            if (result.ok) router.push('/clients');
          });
        }}
        className="text-ink-500 hover:text-coral-600 disabled:opacity-50"
      >
        <Archive className="h-4 w-4" />
      </button>
      {dialog}
    </>
  );
}
