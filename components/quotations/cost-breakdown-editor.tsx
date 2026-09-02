'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { CostItemInput } from '@/lib/validation/quotation';

export function CostBreakdownEditor({
  items,
  onChange,
  quickAddItems = ['Airfare', 'Hotel', 'Roundtrip transfer'],
  totalLabel = 'Total supplier cost',
  customPlaceholder = 'Add custom item (e.g. sleeper bus, client request)…',
}: {
  items: CostItemInput[];
  onChange: (items: CostItemInput[]) => void;
  quickAddItems?: string[];
  totalLabel?: string;
  customPlaceholder?: string;
}) {
  const [customLabel, setCustomLabel] = useState('');
  const total = items.reduce((sum, item) => sum + (item.amount || 0), 0);

  function addItem(label: string) {
    // Quick-add buttons are disabled once used so an agent can't accidentally
    // create two "Airfare" rows by double-clicking — the custom-item field
    // below is still free to add as many entries as needed, including a
    // second airfare-like line for a different flight leg if that's genuinely
    // wanted.
    onChange([...items, { label, amount: 0 }]);
  }

  function updateAmount(index: number, amount: number) {
    onChange(items.map((item, i) => (i === index ? { ...item, amount } : item)));
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function addCustom() {
    const label = customLabel.trim();
    if (!label) return;
    addItem(label);
    setCustomLabel('');
  }

  const usedLabels = new Set(items.map((i) => i.label));

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {quickAddItems.map((label) => (
          <button
            key={label}
            type="button"
            disabled={usedLabels.has(label)}
            onClick={() => addItem(label)}
            className="flex items-center gap-1 rounded-md border border-coral-500/30 bg-surface px-2.5 py-1.5 text-xs font-medium text-coral-700 hover:bg-coral-500/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-3 w-3" /> {label}
          </button>
        ))}
      </div>

      {items.length > 0 && (
        <div className="mb-3 space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={item.label}
                onChange={(e) =>
                  onChange(items.map((it, idx) => (idx === i ? { ...it, label: e.target.value } : it)))
                }
                placeholder="Item"
                className="flex-1 rounded-md border border-sand-200 px-2.5 py-1.5 text-sm outline-none ring-harbor-400 focus:ring-2"
              />
              <div className="relative w-32">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-500">
                  PHP
                </span>
                <input
                  type="number"
                  min={0}
                  // Showing a real 0 here would force the agent to delete it
                  // before typing an amount — a freshly-added row (or one
                  // that's exactly 0) instead renders empty with a "0"
                  // placeholder, which disappears the instant they start
                  // typing, no backspace needed. This is safe specifically
                  // for this optional fee/cost list: there's no real case
                  // for deliberately adding a line item worth exactly PHP 0
                  // — if a cost doesn't apply, the row simply isn't added.
                  value={item.amount === 0 ? '' : item.amount}
                  placeholder="0"
                  onChange={(e) => updateAmount(i, e.target.value === '' ? 0 : Number(e.target.value))}
                  className="w-full rounded-md border border-sand-200 py-1.5 pl-9 pr-2 text-sm outline-none ring-harbor-400 focus:ring-2"
                />
              </div>
              <button
                type="button"
                onClick={() => removeItem(i)}
                className="rounded p-1 text-ink-500 hover:bg-sand-100 hover:text-coral-600"
                aria-label="Remove item"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          value={customLabel}
          onChange={(e) => setCustomLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder={customPlaceholder}
          className="flex-1 rounded-md border border-sand-200 px-2.5 py-1.5 text-sm outline-none ring-harbor-400 focus:ring-2"
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={!customLabel.trim()}
          className="flex items-center gap-1 rounded-md border border-sand-200 px-2.5 py-1.5 text-xs font-medium text-ink-700 hover:bg-sand-100 disabled:opacity-40"
        >
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>

      <div className="mt-3 flex justify-between border-t border-coral-500/20 pt-2 text-sm">
        <span className="font-medium text-ink-700">{totalLabel}</span>
        <span className="font-ticket font-semibold text-ink-900">PHP {total.toLocaleString('en-PH')}</span>
      </div>
    </div>
  );
}
