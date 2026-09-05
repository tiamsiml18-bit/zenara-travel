'use client';

import { useState } from 'react';
import { X, Plus, Pencil, Check, GripVertical } from 'lucide-react';
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
  // Small drag threshold, matching the pipeline Kanban board's existing
  // pattern — without it, a plain click (Edit/Remove buttons, or just
  // clicking to start editing) can get misread as the start of a drag on
  // touch devices.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

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

  // Drag-and-drop reorder — the item itself is never removed and
  // re-added, just moved (arrayMove creates a new array with the item
  // relocated, same content). The existing save path already persists
  // whatever order this array is in when saved (a plain Postgres array
  // column, or sort_order recomputed from the array's index at save
  // time), so no separate "save order" step is needed here.
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = Number(String(active.id).split('-').pop());
    const newIndex = Number(String(over.id).split('-').pop());
    onChange(arrayMove(items, oldIndex, newIndex));
  }

  const dot = tone === 'positive' ? 'bg-green-500 dark:bg-green-600' : tone === 'negative' ? 'bg-coral-500' : 'bg-ink-500';

  return (
    <div>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((_, i) => `tag-${i}`)} strategy={verticalListSortingStrategy}>
          <ul className="mb-2 space-y-1">
            {items.map((item, i) => (
              <SortableTagItem key={`tag-${i}`} id={`tag-${i}`}>
                {editingIndex === i ? (
                  <div className="flex flex-1 items-center gap-2">
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
                  </div>
                ) : (
                  <>
                    <span className="flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
                      {item}
                    </span>
                    <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                      <button type="button" onClick={() => startEdit(i)} className="text-ink-500 hover:text-harbor-600" title="Edit">
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
                  </>
                )}
              </SortableTagItem>
            ))}
            {items.length === 0 && <li className="text-sm text-ink-500">Nothing added yet.</li>}
          </ul>
        </SortableContext>
      </DndContext>
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

/**
 * One draggable row, used for both the normal display state and the
 * inline-editing state — useSortable is called consistently for every
 * item regardless of which is being edited, since dnd-kit's
 * SortableContext expects its item list and rendered items to always
 * line up. Only the drag handle itself is grabbable (not the whole row),
 * so clicking text/buttons never accidentally starts a drag.
 */
function SortableTagItem({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <li ref={setNodeRef} style={style} className="group flex items-center justify-between rounded bg-sand-50 px-2.5 py-1.5 text-sm text-ink-700">
      <span className="flex flex-1 items-center gap-1.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab text-ink-400 hover:text-ink-600 active:cursor-grabbing"
          title="Drag to reorder"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        {children}
      </span>
    </li>
  );
}
