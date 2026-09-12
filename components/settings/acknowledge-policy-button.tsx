'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2 } from 'lucide-react';

export function AcknowledgePolicyButton({
  documentKey,
  documentVersion,
  alreadyAcknowledged,
  acknowledgedAt,
  onAcknowledge,
}: {
  documentKey: string;
  documentVersion: string;
  alreadyAcknowledged: boolean;
  acknowledgedAt?: string;
  onAcknowledge: (documentKey: string, documentVersion: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [isPending, startTransition] = useTransition();
  const [acknowledged, setAcknowledged] = useState(alreadyAcknowledged);
  const [ackTime, setAckTime] = useState(acknowledgedAt);
  const [error, setError] = useState<string | null>(null);

  if (acknowledged) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-harbor-700">
        <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={1.75} />
        Acknowledged{ackTime ? ` on ${new Date(ackTime).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}
      </p>
    );
  }

  return (
    <div>
      {error && <p className="mb-2 text-sm text-coral-600">{error}</p>}
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await onAcknowledge(documentKey, documentVersion);
            if (!result.ok) {
              setError(result.error ?? 'Failed to record acknowledgment.');
              return;
            }
            setAckTime(new Date().toISOString());
            setAcknowledged(true);
          })
        }
        className="rounded-md bg-harbor-700 px-4 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600 disabled:opacity-50"
      >
        {isPending ? 'Recording…' : 'I have read and acknowledge this document'}
      </button>
    </div>
  );
}
