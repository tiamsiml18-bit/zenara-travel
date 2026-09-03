'use client';

import { useState } from 'react';
import { X, Plus, Pencil, Check, ChevronUp, ChevronDown } from 'lucide-react';

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
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');

  function add() {
    const text = draft.trim();
    if (!text) return;
    onChange([...items, text]);
    setDraft('');
  }

  function startEdit(i: number) {
    setEditingIndex(i);
    setEditingText(items[i]!);
  }
  function saveEdit() {
    if (editingIndex === null) return;
    const text = editingText.trim();
    if (text) {
      onChange(items.map((item, idx) => (idx === editingIndex ? text : item)));
    }
    setEditingIndex(null);
  }

  // Reordering swaps two array positions in place — the item itself is
  // never removed and re-added, just moved, so its content is completely
  // untouched. The existing save path already persists whatever order
  // this array is in when saved (a plain Postgres array column, or
  // sort_order recomputed from the array's index at save time), so no
  // separate "save order" step is needed here.
  function move(i: number, direction: -1 | 1) {
    const target = i + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[i], next[target]] = [next[target]!, next[i]!];
    onChange(next);
  }

  const dot = tone === 'positive' ? 'bg-green-500 dark:bg-green-600' : tone === 'negative' ? 'bg-coral-500' : 'bg-ink-500';

  return (
    <div>
      <ul className="mb-2 space-y-1">
        {items.map((item, i) =>
          editingIndex === i ? (
            <li key={i} className="flex items-center gap-2 rounded bg-sand-50 px-2.5 py-1.5">
              <input
                autoFocus
                value={editingText}
                onChange={(e) => setEditingText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    saveEdit();
                  }
                  if (e.key === 'Escape') setEditingIndex(null);
                }}
                className="flex-1 rounded border border-sand-200 bg-surface px-2 py-1 text-sm outline-none ring-harbor-400 focus:ring-2"
              />
              <button type="button" onClick={saveEdit} className="text-harbor-600 hover:text-harbor-700" title="Save">
                <Check className="h-3.5 w-3.5" />
              </button>
            </li>
          ) : (
            <li key={i} className="group flex items-center justify-between rounded bg-sand-50 px-2.5 py-1.5 text-sm text-ink-700">
              <span className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
                {item}
              </span>
              <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="text-ink-500 hover:text-harbor-600 disabled:opacity-0"
                  title="Move up"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === items.length - 1}
                  className="text-ink-500 hover:text-harbor-600 disabled:opacity-0"
                  title="Move down"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => startEdit(i)} className="ml-1 text-ink-500 hover:text-harbor-600" title="Edit">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                  className="text-ink-500 hover:text-coral-500"
                  title="Remove"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            </li>
          )
        )}
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
