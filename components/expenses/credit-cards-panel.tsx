'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { upsertCreditCardAction } from '@/app/(app)/expenses/actions';

interface CardRow {
  id: string;
  card_name: string;
  last_four: string;
  card_type: string | null;
  is_active: boolean;
}

export function CreditCardsPanel({ cards }: { cards: CardRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CardRow | null>(null);

  return (
    <div className="rounded-lg border border-sand-200 bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-700">Credit Cards</h3>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          className="rounded-md border border-sand-200 px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-sand-100"
        >
          + Add Card
        </button>
      </div>
      {cards.length === 0 ? (
        <p className="text-sm text-ink-500">No cards added yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {cards.map((c) => (
            <li key={c.id} className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-sand-50">
              <div>
                <span className="text-sm font-medium text-ink-900">{c.card_name}</span>
                <span className="ml-2 font-ticket text-sm text-ink-500">•••• {c.last_four}</span>
                {!c.is_active && <span className="ml-2 rounded-full bg-sand-100 px-2 py-0.5 text-xs text-ink-500">Inactive</span>}
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditing(c);
                  setOpen(true);
                }}
                className="text-xs font-medium text-harbor-700 hover:underline"
              >
                Edit
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && (
        <CardForm
          initial={editing}
          onClose={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function CardForm({ initial, onClose }: { initial: CardRow | null; onClose: () => void }) {
  const [cardName, setCardName] = useState(initial?.card_name ?? '');
  const [lastFour, setLastFour] = useState(initial?.last_four ?? '');
  const [cardType, setCardType] = useState(initial?.card_type ?? '');
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await upsertCreditCardAction({ id: initial?.id, cardName, lastFour, cardType, isActive });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4">
      <div className="w-full max-w-sm rounded-lg bg-surface p-5 shadow-xl">
        <h3 className="font-display text-base font-semibold text-ink-900">{initial ? 'Edit Card' : 'Add Card'}</h3>
        {error && <div className="mt-3 rounded-md border border-coral-500/30 bg-coral-500/5 px-3 py-2 text-sm text-coral-600">{error}</div>}
        <div className="mt-3 space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-500">Card Name</span>
            <input
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              placeholder="e.g. BDO Visa"
              className="w-full rounded-md border border-sand-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-500">Last 4 Digits</span>
            <input
              value={lastFour}
              onChange={(e) => setLastFour(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="4821"
              className="w-full rounded-md border border-sand-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-500">Card Type (optional)</span>
            <input
              value={cardType}
              onChange={(e) => setCardType(e.target.value)}
              placeholder="e.g. Visa"
              className="w-full rounded-md border border-sand-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Active
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-sand-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-sand-100">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-md bg-harbor-700 px-4 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600 disabled:opacity-60"
          >
            {isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
