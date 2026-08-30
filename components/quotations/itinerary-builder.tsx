'use client';

import { useState } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, X, Sparkles } from 'lucide-react';
import { FREE_TIME_OPTIONS } from '@/lib/utils/free-time-options';

export interface ItineraryDayDraft {
  dayNumber: number;
  dayDate: string;
  title: string;
  description: string;
  activities: string[];
  sourceTourId?: string | null;
}

/** Matches lib/services/tours.ts's listToursForPicker() return shape. */
export interface TourPickerItem {
  id: string;
  name: string;
  destination: string | null;
  description: string | null;
  activities: string[];
  default_inclusions: string[];
  default_exclusions: string[];
  price_senior: number | null;
  price_adult: number | null;
  price_child: number | null;
  price_infant: number | null;
  price_pwd: number | null;
  group_cost: number | null;
  age_range_senior?: string | null;
  age_range_adult?: string | null;
  age_range_child?: string | null;
  age_range_infant?: string | null;
  age_range_pwd?: string | null;
}

export function ItineraryBuilder({
  days,
  onChange,
  tours = [],
  onTourSelected,
}: {
  days: ItineraryDayDraft[];
  onChange: (days: ItineraryDayDraft[]) => void;
  // Optional — the package form doesn't have guest-pricing to feed, so it
  // can pass tours without onTourSelected and just get the itinerary
  // auto-fill; the quotation wizard passes both, so tour selection also
  // pre-fills inclusions/exclusions/pricing.
  tours?: TourPickerItem[];
  onTourSelected?: (tour: TourPickerItem) => void;
}) {
  const [activityDraft, setActivityDraft] = useState<Record<number, string>>({});
  // Destination-first filtering for the tour dropdown, per day — selecting
  // a destination narrows the Tour dropdown to only that destination's
  // tours, per spec ("first select the Destination... show only Boracay
  // tours"). Free Time options are never destination-scoped.
  const [destinationFilter, setDestinationFilter] = useState<Record<number, string>>({});
  const destinations = Array.from(new Set(tours.map((t) => t.destination).filter((d): d is string => Boolean(d)))).sort();

  function renumber(list: ItineraryDayDraft[]) {
    return list.map((d, i) => ({ ...d, dayNumber: i + 1 }));
  }

  function addDay() {
    onChange(
      renumber([
        ...days,
        { dayNumber: days.length + 1, dayDate: '', title: '', description: '', activities: [], sourceTourId: null },
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

  /**
   * Handles both "Add Tour" (a blank day) and "Replace Tour" (a day that
   * already has content) with the same action — selecting anything from the
   * dropdown always fills this day's title/activities from the pick,
   * replacing whatever was there before. That's the same operation either
   * way; there's no need for two separate buttons.
   */
  function handleTourPick(index: number, value: string) {
    if (!value) return;
    const freeTime = FREE_TIME_OPTIONS.find((f) => f.id === value);
    if (freeTime) {
      updateDay(index, { title: freeTime.title, description: '', activities: [...freeTime.activities], sourceTourId: null });
      return;
    }
    const tour = tours.find((t) => t.id === value);
    if (tour) {
      updateDay(index, {
        title: tour.name,
        description: tour.description ?? '',
        activities: [...tour.activities],
        sourceTourId: tour.id,
      });
      onTourSelected?.(tour);
    }
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
              onChange={(e) => updateDay(index, { title: e.target.value, sourceTourId: null })}
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

          {/* Select Tour — loads a saved tour (or a Free Time preset)
              straight from the library, so the agent never retypes a tour's
              activities by hand. Picking here always fills this day fresh;
              it's the same action whether the day was blank (Add) or
              already had a different tour (Replace). Destination first
              narrows the tour list to just that destination — typing in
              either dropdown also jumps to a matching option (native
              browser type-ahead search). */}
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-harbor-500" />
            {destinations.length > 0 && (
              <select
                value={destinationFilter[index] ?? ''}
                onChange={(e) => setDestinationFilter((d) => ({ ...d, [index]: e.target.value }))}
                className="w-36 shrink-0 rounded-md border border-sand-200 bg-sand-50 px-2 py-1.5 text-sm text-ink-700 outline-none ring-harbor-400 focus:ring-2"
              >
                <option value="">All destinations</option>
                {destinations.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            )}
            <select
              value=""
              onChange={(e) => {
                handleTourPick(index, e.target.value);
                e.target.value = '';
              }}
              className="flex-1 rounded-md border border-sand-200 bg-sand-50 px-3 py-1.5 text-sm text-ink-700 outline-none ring-harbor-400 focus:ring-2"
            >
              <option value="">
                {day.sourceTourId ? 'Replace tour…' : 'Select tour or free time…'}
              </option>
              <optgroup label="Free Time">
                {FREE_TIME_OPTIONS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.title}
                  </option>
                ))}
              </optgroup>
              {(() => {
                const filtered = destinationFilter[index]
                  ? tours.filter((t) => t.destination === destinationFilter[index])
                  : tours;
                return (
                  filtered.length > 0 && (
                    <optgroup label="Tours Library">
                      {filtered.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                          {!destinationFilter[index] && t.destination ? ` — ${t.destination}` : ''}
                        </option>
                      ))}
                    </optgroup>
                  )
                );
              })()}
            </select>
          </div>

          <textarea
            value={day.description}
            onChange={(e) => updateDay(index, { description: e.target.value })}
            placeholder="Optional day description…"
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
              placeholder="Add an activity, press Enter…"
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
