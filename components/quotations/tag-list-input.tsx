'use client';

import { useState } from 'react';
import { X, Plus } from 'lucide-react';

export function TagListInput({
  items,
  onChange,
  placeholder,
  tone = 'neutral',
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  tone?: 'neutral' | 'positive' | 'negative';
}) {
  const [draft, setDraft] = useState('');

  function add() {
    const text = draft.trim();
    if (!text) return;
    onChange([...items, text]);
    setDraft('');
  }

  const dot = tone === 'positive' ? 'bg-green-500 dark:bg-green-600' : tone === 'negative' ? 'bg-coral-500' : 'bg-ink-500';

  return (
    <div>
      <ul className="mb-2 space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-center justify-between rounded bg-sand-50 px-2.5 py-1.5 text-sm text-ink-700">
            <span className="flex items-center gap-2">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
              {item}
            </span>
            <button type="button" onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="text-ink-500 hover:text-coral-500">
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
        {items.length === 0 && <li className="text-sm text-ink-500">Nothing added yet.</li>}
      </ul>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="flex-1 rounded-md border border-sand-200 px-3 py-1.5 text-sm outline-none ring-harbor-400 focus:ring-2"
        />
        <button type="button" onClick={add} className="flex items-center gap-1 rounded-md border border-sand-200 px-3 py-1.5 text-sm hover:bg-sand-100">
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>
    </div>
  );
}
