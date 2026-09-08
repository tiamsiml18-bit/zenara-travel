'use client';

import { Plus, Trash2 } from 'lucide-react';

export interface FlightSegmentFields {
  key: string;
  airline: string;
  flightNumber: string;
  departureTime: string;
  arrivalTime: string;
  route: string;
}

const inputClass = 'w-full rounded-md border border-sand-200 px-2.5 py-1.5 text-sm outline-none ring-harbor-400 focus:ring-2';

export function FlightSegmentsEditor({
  segments,
  onChange,
}: {
  segments: FlightSegmentFields[];
  onChange: (next: FlightSegmentFields[]) => void;
}) {
  function update(index: number, patch: Partial<FlightSegmentFields>) {
    onChange(segments.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function addFlight() {
    onChange([
      ...segments,
      { key: `new-${Date.now()}-${Math.random()}`, airline: '', flightNumber: '', departureTime: '', arrivalTime: '', route: '' },
    ]);
  }

  function removeFlight(index: number) {
    onChange(segments.filter((_, i) => i !== index));
  }

  return (
    <div>
      {segments.length === 0 && <p className="mb-2 text-sm text-ink-500">No flight details added yet — optional.</p>}
      <div className="space-y-3">
        {segments.map((segment, i) => (
          <div key={segment.key} className="rounded-md border border-sand-200 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-500">Flight {i + 1}</span>
              <button type="button" onClick={() => removeFlight(i)} className="text-ink-400 hover:text-coral-600" aria-label={`Remove flight ${i + 1}`}>
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <label className="block">
                <span className="mb-1 block text-[11px] text-ink-500">Airline</span>
                <input value={segment.airline} onChange={(e) => update(i, { airline: e.target.value })} placeholder="Philippine Airlines" className={inputClass} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] text-ink-500">Flight Number</span>
                <input value={segment.flightNumber} onChange={(e) => update(i, { flightNumber: e.target.value })} placeholder="PR 123" className={inputClass} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] text-ink-500">Departure Time</span>
                <input value={segment.departureTime} onChange={(e) => update(i, { departureTime: e.target.value })} placeholder="08:30" className={inputClass} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] text-ink-500">Arrival Time</span>
                <input value={segment.arrivalTime} onChange={(e) => update(i, { arrivalTime: e.target.value })} placeholder="10:45" className={inputClass} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] text-ink-500">Route</span>
                <input value={segment.route} onChange={(e) => update(i, { route: e.target.value })} placeholder="MNL → DAD" className={inputClass} />
              </label>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addFlight}
        className="mt-3 inline-flex items-center gap-1 rounded-md border border-sand-200 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-sand-100"
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2} />
        Add Flight
      </button>
    </div>
  );
}
