'use client';

import { useState, useCallback } from 'react';

interface ConfirmOptions {
  title: string;
  description?: string;
  summary?: { label: string; from: string; to: string }[];
  confirmLabel?: string;
  tone?: 'default' | 'danger';
}

/**
 * The single confirmation mechanism for the whole app — per the "confirm
 * major changes, never normal edits" policy: a plain client field edit never
 * touches this; only the specific gated actions (archive, reassign agent,
 * status → Confirmed/Cancelled, convert to booking, save a revision, delete)
 * call it. Styled to match the app rather than the browser's native
 * confirm(), and supports an optional before/after summary list so a
 * revision save can show what's actually changing instead of a bare
 * yes/no prompt.
 */
export function useConfirmDialog() {
  const [state, setState] = useState<
    (ConfirmOptions & { resolve: (v: boolean) => void }) | null
  >(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ ...options, resolve });
    });
  }, []);

  const dialog = state ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-surface p-5 shadow-xl">
        <h3 className="font-display text-base font-semibold text-ink-900">{state.title}</h3>
        {state.description && <p className="mt-1.5 text-sm text-ink-500">{state.description}</p>}
        {state.summary && state.summary.length > 0 && (
          <div className="mt-3 space-y-1.5 rounded-md bg-sand-50 p-3 text-sm">
            {state.summary.map((s, i) => (
              <div key={i}>
                <span className="font-medium text-ink-700">{s.label}: </span>
                <span className="text-ink-500 line-through">{s.from}</span>
                <span className="text-ink-500"> → </span>
                <span className="text-ink-900">{s.to}</span>
              </div>
            ))}
          </div>
        )}
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
            className={
              state.tone === 'danger'
                ? 'rounded-md bg-coral-600 px-4 py-2 text-sm font-medium text-white hover:bg-coral-700'
                : 'rounded-md bg-harbor-700 px-4 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600'
            }
          >
            {state.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, dialog };
}
