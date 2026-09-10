'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { PossibleDuplicateClient } from '@/lib/services/clients';

const MATCH_REASON_LABEL: Record<PossibleDuplicateClient['match_reason'], string> = {
  email: 'Same email address',
  phone: 'Same phone number',
  name: 'Similar name',
};

/**
 * A neutral "this might already exist" warning — never a silent block,
 * never an automatic merge. The agent always gets to choose: look at the
 * existing record, jump straight to editing it, or acknowledge the
 * possible match and save a separate client anyway (e.g. a parent and
 * child who happen to share a name).
 */
export function useDuplicateWarningDialog() {
  const router = useRouter();
  const [state, setState] = useState<{ matches: PossibleDuplicateClient[]; resolve: (v: boolean) => void } | null>(null);

  const warnIfDuplicates = useCallback((matches: PossibleDuplicateClient[]): Promise<boolean> => {
    if (matches.length === 0) return Promise.resolve(true);
    return new Promise((resolve) => {
      setState({ matches, resolve });
    });
  }, []);

  const dialog = state ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-surface p-5 shadow-xl">
        <h3 className="font-display text-base font-semibold text-ink-900">Possible Duplicate Client</h3>
        <p className="mt-1.5 text-sm text-ink-500">
          A client with the same name, email, or phone number already exists.
        </p>

        <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
          {state.matches.map((m) => (
            <div key={m.id} className="rounded-md border border-sand-200 bg-sand-50 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-ink-900">{m.full_name}</p>
                <span className="rounded-full bg-sand-200 px-2 py-0.5 text-[11px] font-medium text-ink-600">
                  {MATCH_REASON_LABEL[m.match_reason]}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-ink-500">
                {m.email || '—'} &middot; {m.mobile_number || '—'}
              </p>
              <div className="mt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    state.resolve(false);
                    setState(null);
                    router.push(`/clients/${m.id}`);
                  }}
                  className="text-xs font-medium text-harbor-700 hover:underline"
                >
                  View Existing Client
                </button>
                <button
                  type="button"
                  onClick={() => {
                    state.resolve(false);
                    setState(null);
                    router.push(`/clients/${m.id}/edit`);
                  }}
                  className="text-xs font-medium text-harbor-700 hover:underline"
                >
                  Edit Existing Client
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              state.resolve(false);
              setState(null);
            }}
            className="rounded-md border border-sand-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-sand-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              state.resolve(true);
              setState(null);
            }}
            className="rounded-md bg-harbor-700 px-4 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600"
          >
            Continue Anyway
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { warnIfDuplicates, dialog };
}
