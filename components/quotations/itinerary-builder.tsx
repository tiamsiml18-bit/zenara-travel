'use client';

import { useState } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, X } from 'lucide-react';

export interface ItineraryDayDraft {
  dayNumber: number;
  dayDate: string;
  title: string;
  description: string;
  activities: string[];
}

export function ItineraryBuilder({
  days,
  onChange,
}: {
  days: ItineraryDayDraft[];
  onChange: (days: ItineraryDayDraft[]) => void;
}) {
  const [activityDraft, setActivityDraft] = useState<Record<number, string>>({});

  function renumber(list: ItineraryDayDraft[]) {
    return list.map((d, i) => ({ ...d, dayNumber: i + 1 }));
  }

  function addDay() {
    onChange(
      renumber([
        ...days,
        { dayNumber: days.length + 1, dayDate: '', title: '', description: '', activities: [] },
      ])
    );
  }

  function removeDay(index: number) {
    onChange(renumber(days.filter((_, i) => i !== index)));
  }

  function moveDay(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= days.length) return;
    const next = [...days];
    const a = next[index];
    const b = next[target];
    if (!a || !b) return;
    next[index] = b;
    next[target] = a;
    onChange(renumber(next));
  }

  function updateDay(index: number, patch: Partial<ItineraryDayDraft>) {
    const next = days.map((d, i) => (i === index ? { ...d, ...patch } : d));
    onChange(next);
  }

  function addActivity(index: number) {
    const text = (activityDraft[index] ?? '').trim();
    const day = days[index];
    if (!text || !day) return;
    updateDay(index, { activities: [...day.activities, text] });
    setActivityDraft((s) => ({ ...s, [index]: '' }));
  }

  function removeActivity(dayIndex: number, activityIndex: number) {
    const day = days[dayIndex];
    if (!day) return;
    updateDay(dayIndex, {
      activities: day.activities.filter((_, i) => i !== activityIndex),
    });
  }

  return (
    <div className="space-y-4">
      {days.map((day, index) => (
        <div key={index} className="rounded-lg border border-sand-200 bg-white p-4">
          <div className="mb-3 flex items-start gap-3">
            <span className="font-ticket mt-1.5 shrink-0 rounded-full bg-harbor-100 px-2.5 py-1 text-xs font-medium text-harbor-700">
              Day {day.dayNumber}
            </span>
            <input
              value={day.title}
              onChange={(e) => updateDay(index, { title: e.target.value })}
              placeholder="Day title, e.g. Arrival | Free Time"
              className="flex-1 rounded-md border border-sand-200 px-3 py-1.5 text-sm outline-none ring-harbor-400 focus:ring-2"
            />
            <input
              type="date"
              value={day.dayDate}
              onChange={(e) => updateDay(index, { dayDate: e.target.value })}
              className="w-40 rounded-md border border-sand-200 px-2 py-1.5 text-sm outline-none ring-harbor-400 focus:ring-2"
            />
            <div className="flex shrink-0 gap-0.5">
              <IconButton onClick={() => moveDay(index, -1)} disabled={index === 0} label="Move up">
                <ChevronUp className="h-4 w-4" />
              </IconButton>
              <IconButton onClick={() => moveDay(index, 1)} disabled={index === days.length - 1} label="Move down">
                <ChevronDown className="h-4 w-4" />
              </IconButton>
              <IconButton onClick={() => removeDay(index)} label="Remove day">
                <Trash2 className="h-4 w-4 text-coral-500" />
              </IconButton>
            </div>
          </div>

          <textarea
            value={day.description}
            onChange={(e) => updateDay(index, { description: e.target.value })}
            placeholder="Optional day description\u2026"
            rows={2}
            className="mb-3 w-full rounded-md border border-sand-200 px-3 py-1.5 text-sm outline-none ring-harbor-400 focus:ring-2"
          />

          <ul className="mb-2 space-y-1">
            {day.activities.map((activity, aIndex) => (
              <li key={aIndex} className="flex items-center justify-between rounded bg-sand-50 px-2.5 py-1 text-sm text-ink-700">
                {activity}
                <button type="button" onClick={() => removeActivity(index, aIndex)} className="text-ink-500 hover:text-coral-500">
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>

          <div className="flex gap-2">
            <input
              value={activityDraft[index] ?? ''}
              onChange={(e) => setActivityDraft((s) => ({ ...s, [index]: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addActivity(index);
                }
              }}
              placeholder="Add an activity, press Enter\u2026"
              className="flex-1 rounded-md border border-sand-200 px-3 py-1.5 text-sm outline-none ring-harbor-400 focus:ring-2"
            />
            <button
              type="button"
              onClick={() => addActivity(index)}
              className="rounded-md border border-sand-200 px-3 py-1.5 text-sm hover:bg-sand-100"
            >
              Add
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addDay}
        className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-sand-200 py-2.5 text-sm font-medium text-ink-500 hover:border-harbor-400 hover:text-harbor-600"
      >
        <Plus className="h-4 w-4" /> Add day
      </button>
    </div>
  );
}

function IconButton({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="rounded-md p-1.5 text-ink-500 hover:bg-sand-100 disabled:opacity-30"
    >
      {children}
    </button>
  );
}
