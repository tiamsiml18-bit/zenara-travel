'use client';

import { useState, useTransition } from 'react';
import { Link2, AlertTriangle, Loader2 } from 'lucide-react';
import { ItineraryBuilder, type ItineraryDayDraft } from './itinerary-builder';
import { TagListInput } from './tag-list-input';
import { extractSupplierUrlAction } from '@/app/(app)/quotations/supplier-import-actions';
import type { ExtractedPackageData } from '@/lib/suppliers/types';

export interface AppliedSupplierData {
  destination: string;
  itinerary: ItineraryDayDraft[];
  inclusions: string[];
  exclusions: string[];
  notes: string;
}

type PanelState = 'input' | 'loading' | 'error' | 'review';

export function SupplierImportPanel({
  onApply,
  onCancel,
}: {
  onApply: (data: AppliedSupplierData) => void;
  onCancel: () => void;
}) {
  const [state, setState] = useState<PanelState>('input');
  const [url, setUrl] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  // Editable review fields, seeded from the extraction result once it comes back.
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [pickupInfo, setPickupInfo] = useState('');
  const [meals, setMeals] = useState('');
  const [importantNotes, setImportantNotes] = useState('');
  const [itinerary, setItinerary] = useState<ItineraryDayDraft[]>([]);
  const [inclusions, setInclusions] = useState<string[]>([]);
  const [exclusions, setExclusions] = useState<string[]>([]);
  const [sourceUrl, setSourceUrl] = useState('');
  const [supplierName, setSupplierName] = useState('');

  function seedFromExtraction(data: ExtractedPackageData) {
    setTitle(data.title);
    setDestination(data.destination ?? '');
    setPickupInfo(data.pickupInfo ?? '');
    setMeals(data.meals ?? '');
    setImportantNotes(data.importantNotes ?? '');
    setItinerary(
      data.itinerary.map((d) => ({ dayNumber: d.dayNumber, dayDate: '', title: d.title, description: d.description, activities: d.activities }))
    );
    setInclusions(data.inclusions);
    setExclusions(data.exclusions);
    setSourceUrl(data.sourceUrl);
    setSupplierName(data.supplierName);
  }

  function handleFetch() {
    setErrorMessage(null);
    startTransition(async () => {
      setState('loading');
      const result = await extractSupplierUrlAction(url);
      if (!result.ok || !result.data) {
        setErrorMessage(result.error ?? 'Something went wrong extracting that page.');
        setState('error');
        return;
      }
      seedFromExtraction(result.data);
      setWarnings(result.warnings);
      setState('review');
    });
  }

  function handleApply() {
    const notesParts = [
      importantNotes && `Important notes: ${importantNotes}`,
      pickupInfo && `Pickup: ${pickupInfo}`,
      meals && `Meals: ${meals}`,
      sourceUrl && `Sourced from ${supplierName}: ${sourceUrl}`,
    ].filter(Boolean);

    onApply({
      destination,
      itinerary,
      inclusions,
      exclusions,
      notes: notesParts.join('\n'),
    });
  }

  return (
    <div className="rounded-lg border border-sand-200 bg-surface p-5">
      {state === 'input' && (
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-ink-900">
            <Link2 className="h-4 w-4 text-harbor-600" /> Import from supplier URL
          </div>
          <p className="mb-3 text-sm text-ink-500">
            Paste a public package page (e.g. from Klook) and we'll pull in whatever we can find — you'll review
            and edit everything before it's saved anywhere.
          </p>
          <div className="flex gap-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.klook.com/activity/..."
              className="flex-1 rounded-md border border-sand-200 px-3 py-2 text-sm outline-none ring-harbor-400 focus:ring-2"
            />
            <button
              type="button"
              disabled={!url.trim() || isPending}
              onClick={handleFetch}
              className="rounded-md bg-harbor-700 px-4 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600 disabled:opacity-40"
            >
              Fetch details
            </button>
          </div>
          <button type="button" onClick={onCancel} className="mt-3 text-sm text-ink-500 hover:text-ink-900">
            Cancel and build manually instead
          </button>
        </div>
      )}

      {state === 'loading' && (
        <div className="flex flex-col items-center py-10 text-center">
          <Loader2 className="mb-3 h-6 w-6 animate-spin text-harbor-600" />
          <p className="text-sm text-ink-500">Reading that page…</p>
        </div>
      )}

      {state === 'error' && (
        <div>
          <div className="mb-3 flex items-start gap-2 rounded-md border border-coral-500/30 bg-coral-500/5 px-3 py-2.5 text-sm text-coral-600">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setState('input')}
              className="rounded-md border border-sand-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-sand-100"
            >
              Try another URL
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md bg-harbor-700 px-4 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600"
            >
              Enter details manually
            </button>
          </div>
        </div>
      )}

      {state === 'review' && (
        <div>
          <div className="mb-4 flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Extracted from {supplierName}</p>
              <p className="font-display text-base font-semibold text-ink-900">{title || 'Untitled package'}</p>
            </div>
            <button type="button" onClick={() => setState('input')} className="text-xs font-medium text-harbor-600 hover:underline">
              Try a different URL
            </button>
          </div>

          {warnings.length > 0 && (
            <div className="mb-4 rounded-md border border-amber-300 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300">
              <p className="mb-1 font-medium">Review carefully — some fields couldn't be found automatically:</p>
              <ul className="list-inside list-disc space-y-0.5">
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mb-4 grid grid-cols-2 gap-3">
            <Field label="Destination">
              <input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g. Ha Long Bay, Vietnam"
                className="w-full rounded-md border border-sand-200 px-3 py-2 text-sm outline-none ring-harbor-400 focus:ring-2"
              />
            </Field>
            <Field label="Pickup information">
              <input
                value={pickupInfo}
                onChange={(e) => setPickupInfo(e.target.value)}
                placeholder="Not found — add if applicable"
                className="w-full rounded-md border border-sand-200 px-3 py-2 text-sm outline-none ring-harbor-400 focus:ring-2"
              />
            </Field>
            <Field label="Meals">
              <input
                value={meals}
                onChange={(e) => setMeals(e.target.value)}
                placeholder="Not found — add if applicable"
                className="w-full rounded-md border border-sand-200 px-3 py-2 text-sm outline-none ring-harbor-400 focus:ring-2"
              />
            </Field>
            <Field label="Important notes">
              <input
                value={importantNotes}
                onChange={(e) => setImportantNotes(e.target.value)}
                className="w-full rounded-md border border-sand-200 px-3 py-2 text-sm outline-none ring-harbor-400 focus:ring-2"
              />
            </Field>
          </div>

          <div className="mb-4">
            <p className="mb-2 text-sm font-medium text-ink-700">Itinerary</p>
            <ItineraryBuilder days={itinerary} onChange={setItinerary} />
          </div>

          <div className="mb-5 grid grid-cols-2 gap-6">
            <div>
              <p className="mb-2 text-sm font-medium text-ink-700">Inclusions</p>
              <TagListInput items={inclusions} onChange={setInclusions} placeholder="Add an inclusion…" tone="positive" />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-ink-700">Exclusions</p>
              <TagListInput items={exclusions} onChange={setExclusions} placeholder="Add an exclusion…" tone="negative" />
            </div>
          </div>

          <div className="flex justify-between">
            <button type="button" onClick={onCancel} className="rounded-md border border-sand-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-sand-100">
              Discard
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={!destination.trim()}
              className="rounded-md bg-harbor-700 px-4 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600 disabled:opacity-40"
            >
              Use this data
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-ink-700">{label}</label>
      {children}
    </div>
  );
}
