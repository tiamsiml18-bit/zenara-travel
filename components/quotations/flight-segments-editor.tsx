'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { formatTimeInput } from '@/lib/utils/flight-time';
import { buildAutoRoute, computeCarryForward } from '@/lib/utils/flight-details';
import { formatAirportLabel } from '@/lib/utils/airport-label';

// The airport dataset is ~700KB of JSON — loaded lazily, on first actual
// interaction with a Departure/Arrival field, rather than bundled into
// every quotation page load (most quotations never touch Flight
// Details at all). Deliberately no static import of airport-lookup.ts
// here: that module's own top-level `import airportsData from
// '@/lib/data/airports.json'` means ANY static import of it, for any
// export, pulls the full JSON into this component's bundle regardless
// of which named export is actually used. formatAirportLabel is safe to
// import statically since it now lives in a JSON-free module.
interface Airport {
  code: string;
  name: string;
  city: string;
  country: string;
}
type SearchAirportsFn = (query: string, limit?: number) => Airport[];
let cachedSearch: SearchAirportsFn | null = null;
async function loadSearchAirports(): Promise<SearchAirportsFn> {
  if (cachedSearch) return cachedSearch;
  const mod = await import('@/lib/utils/airport-lookup');
  cachedSearch = mod.searchAirports;
  return cachedSearch;
}

export interface FlightSegmentFields {
  key: string;
  airline: string;
  flightNumber: string;
  departure: string;
  arrival: string;
  departureTime: string;
  arrivalTime: string;
  route: string;
  // Tracks whether the agent has ever typed directly into Route for this
  // segment -- once true, automatic generation from Departure/Arrival
  // stops touching it, per spec ("do not overwrite the manual value").
  routeManuallyEdited?: boolean;
}

const inputClass = 'w-full rounded-md border border-sand-200 px-2.5 py-1.5 text-sm outline-none ring-harbor-400 focus:ring-2';

/** Departure/Arrival field — free-text with a searchable dropdown of matching airports. Selecting one stores "City (CODE)"; typing without selecting keeps the agent's own text untouched (never forces a match). Route auto-generation and carry-forward only react once a value is actually committed (a selection, or blurring away) -- never on every keystroke, so an in-progress "Sing..." can't get carried forward as a half-typed, code-less value before the agent finishes picking "Singapore (SIN)". */
function AirportInput({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Airport[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  // Guards against the delayed blur-commit below firing with a stale
  // closure over `draft` from *before* a dropdown selection just landed
  // — selectAirport sets this, and the pending blur timeout checks it
  // before committing anything.
  const justSelectedRef = useRef(false);

  useEffect(() => setDraft(value), [value]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        onChange(draft);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draft]);

  function handleInput(next: string) {
    setDraft(next);
    loadSearchAirports().then((search) => setResults(search(next)));
    setOpen(true);
  }

  function selectAirport(airport: Airport) {
    justSelectedRef.current = true;
    const label = formatAirportLabel(airport);
    setDraft(label);
    onChange(label);
    setOpen(false);
  }

  function handleBlur() {
    setTimeout(() => {
      if (justSelectedRef.current) {
        justSelectedRef.current = false;
        return;
      }
      setOpen(false);
      setDraft((current) => {
        onChange(current);
        return current;
      });
    }, 150);
  }

  return (
    <label className="relative block" ref={wrapRef as unknown as React.RefObject<HTMLLabelElement>}>
      <span className="mb-1 block text-[11px] text-ink-500">{label}</span>
      <input
        value={draft}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => {
          loadSearchAirports().then((search) => setResults(search(draft)));
          setOpen(true);
        }}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={inputClass}
        autoComplete="off"
      />
      {open && results.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-52 w-64 overflow-y-auto rounded-md border border-sand-200 bg-surface shadow-lg">
          {results.map((a) => (
            <button
              key={a.code}
              type="button"
              onClick={() => selectAirport(a)}
              className="block w-full px-3 py-1.5 text-left text-xs hover:bg-sand-100"
            >
              <span className="font-medium text-ink-900">
                {a.city} ({a.code})
              </span>
              <span className="block text-[11px] text-ink-500">{a.name}</span>
            </button>
          ))}
        </div>
      )}
    </label>
  );
}

/** Time field — accepts fast entry like "700PM" and auto-formats to "7:00 PM" on blur. Invalid entries surface a clear message rather than a guessed value. */
function TimeInput({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setDraft(value), [value]);

  function handleBlur() {
    const result = formatTimeInput(draft);
    setError(result.error);
    if (!result.error) {
      const next = result.formatted ?? '';
      setDraft(next);
      onChange(next);
    }
  }

  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-ink-500">{label}</span>
      <input
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          if (error) setError(null);
        }}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={`${inputClass} ${error ? 'border-coral-500' : ''}`}
      />
      {error && <span className="mt-0.5 block text-[11px] text-coral-600">{error}</span>}
    </label>
  );
}

export function FlightSegmentsEditor({
  segments,
  onChange,
}: {
  segments: FlightSegmentFields[];
  onChange: (next: FlightSegmentFields[]) => void;
}) {
  function update(index: number, patch: Partial<FlightSegmentFields>) {
    let next = segments.map((s, i) => (i === index ? { ...s, ...patch } : s));

    // Route auto-regenerates from Departure/Arrival for this segment,
    // unless the agent has already typed directly into Route -- that
    // manual value is never overwritten.
    if (('departure' in patch || 'arrival' in patch) && !next[index]!.routeManuallyEdited) {
      const auto = buildAutoRoute(next[index]!.departure, next[index]!.arrival);
      if (auto !== null) next = next.map((s, i) => (i === index ? { ...s, route: auto } : s));
    }

    // Carry-forward: next segment's empty departure, and (for a simple
    // round trip) the return segment's empty arrival, both auto-fill --
    // only ever into fields that are still blank.
    if ('departure' in patch || 'arrival' in patch) {
      const carryPatches = computeCarryForward(next, index);
      carryPatches.forEach((carryPatch, i) => {
        next = next.map((s, si) => (si === i ? { ...s, ...carryPatch } : s));
        if (!next[i]!.routeManuallyEdited) {
          const auto = buildAutoRoute(next[i]!.departure, next[i]!.arrival);
          if (auto !== null) next = next.map((s, si) => (si === i ? { ...s, route: auto } : s));
        }
      });
    }

    onChange(next);
  }

  function addFlight() {
    const prev = segments[segments.length - 1];
    onChange([
      ...segments,
      {
        key: `new-${Date.now()}-${Math.random()}`,
        airline: '',
        flightNumber: '',
        // A freshly added segment carries the previous one's arrival
        // forward as its own departure, same as the carry-forward rule
        // above -- useful for multi-city itineraries added one leg at a
        // time via + Add Flight.
        departure: prev?.arrival ?? '',
        arrival: '',
        departureTime: '',
        arrivalTime: '',
        route: prev?.arrival ? (buildAutoRoute(prev.arrival, '') ?? '') : '',
      },
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
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <label className="block">
                <span className="mb-1 block text-[11px] text-ink-500">Airline</span>
                <input value={segment.airline} onChange={(e) => update(i, { airline: e.target.value })} placeholder="Philippine Airlines" className={inputClass} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] text-ink-500">Flight Number</span>
                <input value={segment.flightNumber} onChange={(e) => update(i, { flightNumber: e.target.value })} placeholder="PR 123" className={inputClass} />
              </label>
              <AirportInput label="Departure" placeholder="Manila" value={segment.departure} onChange={(v) => update(i, { departure: v })} />
              <AirportInput label="Arrival" placeholder="Singapore" value={segment.arrival} onChange={(v) => update(i, { arrival: v })} />
              <TimeInput label="Departure Time" placeholder="700AM" value={segment.departureTime} onChange={(v) => update(i, { departureTime: v })} />
              <TimeInput label="Arrival Time" placeholder="900AM" value={segment.arrivalTime} onChange={(v) => update(i, { arrivalTime: v })} />
              <label className="col-span-2 block">
                <span className="mb-1 block text-[11px] text-ink-500">Route</span>
                <input
                  value={segment.route}
                  onChange={(e) => update(i, { route: e.target.value, routeManuallyEdited: true })}
                  placeholder="MNL - SIN"
                  className={inputClass}
                />
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
