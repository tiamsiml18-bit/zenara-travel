'use client';

import { useState, useRef, useEffect } from 'react';
import { DayPicker, type DateRange } from 'react-day-picker';
import { Calendar } from 'lucide-react';
import 'react-day-picker/style.css';

function parseLocalDate(iso: string): Date | undefined {
  if (!iso) return undefined;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}
function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function formatDisplay(iso: string): string {
  const date = parseLocalDate(iso);
  if (!date) return '';
  return date.toLocaleDateString('en-PH', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

/**
 * Replaces two separate native <input type="date"> fields with one
 * connected range-selection experience: click either field, pick a start
 * date, then continue in the SAME calendar to pick the end date — no
 * separate popup ever opens for the second date. Two months are shown
 * side by side so a range spanning a month boundary never requires
 * navigating away mid-selection.
 */
export function DateRangePicker({
  startDate,
  endDate,
  onChange,
  startLabel = 'Travel start date',
  endLabel = 'Travel end date',
}: {
  startDate: string;
  endDate: string;
  onChange: (range: { startDate: string; endDate: string }) => void;
  startLabel?: string;
  endLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  // Tracks whether a first click has already happened during the
  // CURRENT time the popover is open. react-day-picker's range mode
  // reports back {from: X, to: X} for the very first click (before a
  // second date has actually been chosen) — without this flag, that
  // looks identical to "a complete range was just picked" and the
  // popover would incorrectly close after only one click, which is
  // exactly the "opens another separate calendar" problem this feature
  // exists to avoid. Resetting it on open (not just on mount) means
  // reopening the picker to change an already-set range still requires
  // two clicks to close again, matching how the first pick worked.
  const [hasPickedInSession, setHasPickedInSession] = useState(false);
  // The date currently under the pointer, while a start date is picked
  // but an end date isn't yet — drives the "preview" highlight showing
  // the full range the agent would get if they clicked right now,
  // matching the reference's "hovered dates while choosing" requirement,
  // not just a highlight on the single cell under the pointer.
  const [hoveredDate, setHoveredDate] = useState<Date | undefined>(undefined);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function openPicker() {
    setHasPickedInSession(false);
    setOpen(true);
  }

  const selected: DateRange | undefined =
    startDate || endDate ? { from: parseLocalDate(startDate), to: parseLocalDate(endDate) } : undefined;

  // Only meaningful once a start date is picked but the range isn't
  // complete yet (the popover is still open specifically because we're
  // waiting on the second click — endDate itself gets set equal to
  // startDate as an intermediate step on the very first click, so that
  // alone can't be used to detect "still choosing").
  const previewRange: Date[] =
    open && hasPickedInSession && selected?.from && hoveredDate
      ? (() => {
          const [lo, hi] = hoveredDate < selected.from! ? [hoveredDate, selected.from!] : [selected.from!, hoveredDate];
          const days: Date[] = [];
          const cursor = new Date(lo);
          cursor.setDate(cursor.getDate() + 1);
          while (cursor < hi) {
            days.push(new Date(cursor));
            cursor.setDate(cursor.getDate() + 1);
          }
          return days;
        })()
      : [];

  function handleSelect(range: DateRange | undefined) {
    const nextStart = range?.from ? toIso(range.from) : '';
    const nextEnd = range?.to ? toIso(range.to) : '';
    onChange({ startDate: nextStart, endDate: nextEnd });
    if (hasPickedInSession) {
      // This is the second click in this session — the range is now
      // actually complete, so close.
      if (nextStart && nextEnd) setOpen(false);
    } else {
      // First click in this session — just the start date, even though
      // it's reported with to === from. Keep the calendar open so the
      // agent continues straight into picking the end date.
      setHasPickedInSession(true);
    }
  }

  return (
    <div ref={ref} className="relative">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-700">{startLabel}</label>
          <button
            type="button"
            onClick={openPicker}
            className="flex w-full items-center gap-2 rounded-md border border-sand-200 px-3 py-2 text-left text-sm outline-none ring-harbor-400 focus:ring-2"
          >
            <Calendar className="h-4 w-4 shrink-0 text-ink-500" />
            <span className={startDate ? 'text-ink-900' : 'text-ink-500'}>{formatDisplay(startDate) || 'mm/dd/yyyy'}</span>
          </button>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-700">{endLabel}</label>
          <button
            type="button"
            onClick={openPicker}
            className="flex w-full items-center gap-2 rounded-md border border-sand-200 px-3 py-2 text-left text-sm outline-none ring-harbor-400 focus:ring-2"
          >
            <Calendar className="h-4 w-4 shrink-0 text-ink-500" />
            <span className={endDate ? 'text-ink-900' : 'text-ink-500'}>{formatDisplay(endDate) || 'mm/dd/yyyy'}</span>
          </button>
        </div>
      </div>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 rounded-lg border border-sand-200 bg-surface p-3 shadow-lg">
          <DayPicker
            mode="range"
            numberOfMonths={2}
            defaultMonth={parseLocalDate(startDate) ?? new Date()}
            selected={selected}
            onSelect={handleSelect}
            onDayMouseEnter={(day) => setHoveredDate(day)}
            onDayMouseLeave={() => setHoveredDate(undefined)}
            modifiers={{ previewRange }}
            modifiersClassNames={{ previewRange: '[&>button]:bg-harbor-50' }}
            classNames={{
              months: 'flex gap-6',
              month: 'space-y-3',
              month_caption: 'flex justify-center pt-1 relative items-center',
              caption_label: 'text-sm font-semibold text-ink-900',
              nav: 'flex items-center justify-between absolute inset-x-0',
              button_previous:
                'h-7 w-7 flex items-center justify-center rounded-md text-ink-500 hover:bg-sand-100 hover:text-ink-900',
              button_next: 'h-7 w-7 flex items-center justify-center rounded-md text-ink-500 hover:bg-sand-100 hover:text-ink-900',
              month_grid: 'w-full border-collapse mt-2',
              weekdays: 'flex',
              weekday: 'w-9 text-center text-[11px] font-medium uppercase tracking-wide text-ink-500',
              week: 'flex mt-1',
              day: 'h-9 w-9 text-center text-sm p-0 relative',
              day_button: 'h-9 w-9 rounded-full text-ink-900 hover:bg-sand-100 transition-colors',
              range_start: '[&>button]:bg-harbor-700 [&>button]:text-white [&>button]:hover:bg-harbor-700 rounded-l-full bg-harbor-100',
              range_end: '[&>button]:bg-harbor-700 [&>button]:text-white [&>button]:hover:bg-harbor-700 rounded-r-full bg-harbor-100',
              range_middle: 'bg-harbor-100 [&>button]:bg-transparent [&>button]:text-harbor-800 [&>button]:rounded-none',
              selected: '',
              today: '[&>button]:border [&>button]:border-harbor-400',
              outside: '[&>button]:text-ink-500/40',
              disabled: '[&>button]:text-ink-500/30 [&>button]:hover:bg-transparent',
            }}
          />
        </div>
      )}
    </div>
  );
}
