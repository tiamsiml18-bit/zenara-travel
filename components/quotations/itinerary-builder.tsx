'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, X, Sparkles } from 'lucide-react';
import { FREE_TIME_OPTIONS } from '@/lib/utils/free-time-options';
import { computeDayDate } from '@/lib/utils/itinerary-dates';

export interface ItineraryDayDraft {
  dayNumber: number;
  dayDate: string;
  title: string;
  description: string;
  activities: string[];
  sourceTourId?: string | null;
  // True once the agent has manually typed a date for this day — from then
  // on, a change to the quotation's Travel Start Date must never silently
  // overwrite it. Undefined/false means this day's date is still "auto
  // following" the trip's start date.
  dateManuallyEdited?: boolean;
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
  travelStartDate,
}: {
  days: ItineraryDayDraft[];
  onChange: (days: ItineraryDayDraft[]) => void;
  // Optional — the package form doesn't have guest-pricing to feed, so it
  // can pass tours without onTourSelected and just get the itinerary
  // auto-fill; the quotation wizard passes both, so tour selection also
  // pre-fills inclusions/exclusions/pricing.
  tours?: TourPickerItem[];
  onTourSelected?: (tour: TourPickerItem) => void;
  // Optional — only the quotation wizard has a trip-level Travel Start
  // Date to carry forward into each day; the Package form has no such
  // concept (a package is a reusable template, not date-specific), so
  // passing nothing here leaves day dates exactly as manually entered,
  // matching the existing Package behavior untouched.
  travelStartDate?: string;
}) {
  const [activityDraft, setActivityDraft] = useState<Record<number, string>>({});
  // Destination-first filtering for the tour dropdown, per day — selecting
  // a destination narrows the Tour dropdown to only that destination's
  // tours, per spec ("first select the Destination... show only Boracay
  // tours"). Free Time options are never destination-scoped.
  const [destinationFilter, setDestinationFilter] = useState<Record<number, string>>({});
  const destinations = Array.from(new Set(tours.map((t) => t.destination).filter((d): d is string => Boolean(d)))).sort();

  /** Day N's date = Travel Start Date + (N-1) days, computed in UTC so it can't drift by a day depending on server timezone. */

  // Keeps every day that hasn't been manually edited following the trip's
  // Travel Start Date — so changing the start date shifts the whole
  // itinerary forward or back automatically, per spec, while any day the
  // agent has deliberately overridden is left exactly as they set it.
  useEffect(() => {
    if (!travelStartDate) return;
    const next = days.map((d) =>
      d.dateManuallyEdited ? d : { ...d, dayDate: computeDayDate(travelStartDate, d.dayNumber) }
    );
    // Only push an update if something actually changed, to avoid an
    // infinite render loop from onChange triggering this effect again.
    const changed = next.some((d, i) => d.dayDate !== days[i]?.dayDate);
    if (changed) onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [travelStartDate, days.length]);

  function renumber(list: ItineraryDayDraft[]) {
    return list.map((d, i) => ({ ...d, dayNumber: i + 1 }));
  }

  function addDay() {
    const dayNumber = days.length + 1;
    onChange(
      renumber([
        ...days,
        {
          dayNumber,
          dayDate: travelStartDate ? computeDayDate(travelStartDate, dayNumber) : '',
          title: '',
          description: '',
          activities: [],
          sourceTourId: null,
        },
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

  // Swaps two activities' positions within the same day — the activity
  // itself is never removed and re-added, just moved. This array is a
  // plain Postgres array column (quotation_itinerary_days.activities /
  // tours.activities), so whatever order it's in when the day/tour is
  // saved is exactly the order that persists — no separate "save order"
  // step needed.
  function moveActivity(dayIndex: number, activityIndex: number, direction: -1 | 1) {
    const day = days[dayIndex];
    if (!day) return;
    const target = activityIndex + direction;
    if (target < 0 || target >= day.activities.length) return;
    const next = [...day.activities];
    [next[activityIndex], next[target]] = [next[target]!, next[activityIndex]!];
    updateDay(dayIndex, { activities: next });
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
        <div key={index} className="rounded-lg border border-sand-200 bg-surface p-4">
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
            <div className="flex shrink-0 flex-col items-end gap-0.5">
              <input
                type="date"
                value={day.dayDate}
                onChange={(e) => updateDay(index, { dayDate: e.target.value, dateManuallyEdited: true })}
                className="w-40 rounded-md border border-sand-200 px-2 py-1.5 text-sm outline-none ring-harbor-400 focus:ring-2"
              />
              {travelStartDate && day.dateManuallyEdited && (
                <button
                  type="button"
                  onClick={() =>
                    updateDay(index, { dayDate: computeDayDate(travelStartDate, day.dayNumber), dateManuallyEdited: false })
                  }
                  className="text-[11px] text-harbor-600 hover:underline"
                >
                  Reset to Day {day.dayNumber} default
                </button>
              )}
            </div>
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
              <li key={aIndex} className="group flex items-center justify-between rounded bg-sand-50 px-2.5 py-1 text-sm text-ink-700">
                {activity}
                <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => moveActivity(index, aIndex, -1)}
                    disabled={aIndex === 0}
                    className="text-ink-500 hover:text-harbor-600 disabled:opacity-0"
                    title="Move up"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveActivity(index, aIndex, 1)}
                    disabled={aIndex === day.activities.length - 1}
                    className="text-ink-500 hover:text-harbor-600 disabled:opacity-0"
                    title="Move down"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => removeActivity(index, aIndex)} className="ml-1 text-ink-500 hover:text-coral-500" title="Remove">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
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
