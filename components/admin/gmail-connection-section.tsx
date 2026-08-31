'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, CheckCircle2 } from 'lucide-react';
import { disconnectGmailAction } from '@/app/(app)/admin/settings/actions';

export function GmailConnectionSection({ connectedEmail }: { connectedEmail: string | null }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (connectedEmail) {
    return (
      <div>
        <div className="mb-3 flex items-center gap-2 rounded-md bg-harbor-50 px-3 py-2 text-sm text-harbor-700">
          <CheckCircle2 className="h-4 w-4" />
          Connected: <span className="font-medium">{connectedEmail}</span>
        </div>
        <p className="mb-3 text-xs text-ink-500">
          Quotation and follow-up emails send from this account. Only the Gmail "send" permission was granted — never
          read access, and the password was never seen or stored.
        </p>
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await disconnectGmailAction();
              router.refresh();
            })
          }
          className="rounded-md border border-sand-200 px-3 py-1.5 text-sm text-coral-600 hover:bg-coral-50 disabled:opacity-50"
        >
          {isPending ? 'Disconnecting…' : 'Disconnect Gmail'}
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 text-xs text-ink-500">
        Connect the agency's regular Gmail account (no Google Workspace or paid plan needed) so quotation and follow-up
        emails send directly from the CRM.
      </p>
      <a
        href="/api/auth/gmail/connect"
        className="flex w-fit items-center gap-1.5 rounded-md bg-harbor-700 px-4 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600"
      >
        <Mail className="h-4 w-4" /> Connect Gmail
      </a>
    </div>
  );
}
