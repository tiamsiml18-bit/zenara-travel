'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ItineraryBuilder, type ItineraryDayDraft, type TourPickerItem } from '@/components/quotations/itinerary-builder';
import { TagListInput } from '@/components/quotations/tag-list-input';
import { createPackageAction, updatePackageAction } from '@/app/(app)/packages/actions';
import type { PackageFormInput } from '@/lib/validation/package';

export interface PackageFormInitialData {
  name: string;
  destination: string;
  numDays: number;
  numNights: number;
  defaultNotes: string;
  isActive: boolean;
  itinerary: ItineraryDayDraft[];
  inclusions: string[];
  exclusions: string[];
}

export function PackageForm({
  mode = 'create',
  packageId,
  initialData,
  tours = [],
}: {
  mode?: 'create' | 'edit';
  packageId?: string;
  initialData?: PackageFormInitialData;
  tours?: TourPickerItem[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initialData?.name ?? '');
  const [destination, setDestination] = useState(initialData?.destination ?? '');
  const [numDays, setNumDays] = useState(initialData?.numDays ?? 4);
  const [numNights, setNumNights] = useState(initialData?.numNights ?? 3);
  const [defaultNotes, setDefaultNotes] = useState(initialData?.defaultNotes ?? '');
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);
  const [itinerary, setItinerary] = useState<ItineraryDayDraft[]>(initialData?.itinerary ?? []);
  const [inclusions, setInclusions] = useState<string[]>(initialData?.inclusions ?? []);
  const [exclusions, setExclusions] = useState<string[]>(initialData?.exclusions ?? []);

  // Packages have no per-guest-type pricing of their own (that's set once a
  // package becomes an actual quotation) — selecting a tour here only needs
  // to merge its default inclusions/exclusions, skipping exact duplicates.
  function handleTourSelected(tour: TourPickerItem) {
    setInclusions((prev) => Array.from(new Set([...prev, ...tour.default_inclusions])));
    setExclusions((prev) => Array.from(new Set([...prev, ...tour.default_exclusions])));
  }

  function handleSubmit() {
    setError(null);
    if (!name.trim() || !destination.trim()) {
      setError('Package name and destination are required.');
      return;
    }

    const input: PackageFormInput = {
      name,
      destination,
      numDays,
      numNights,
      defaultNotes,
      isActive,
      itinerary,
      inclusions,
      exclusions,
    };

    startTransition(async () => {
      const result =
        mode === 'edit' && packageId
          ? await updatePackageAction(packageId, input)
          : await createPackageAction(input);

      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/packages/${result.packageId}`);
    });
  }

  return (
    <div className="max-w-3xl space-y-6">
      {error && (
        <div className="rounded-md border border-coral-500/30 bg-coral-500/5 px-3 py-2 text-sm text-coral-600">
          {error}
        </div>
      )}

      <section className="rounded-lg border border-sand-200 bg-white p-5">
        <h3 className="mb-4 font-display text-sm font-semibold text-ink-900">Package details</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Package name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Hanoi 5D4N"
              className="w-full rounded-md border border-sand-200 px-3 py-2 text-sm outline-none ring-harbor-400 focus:ring-2"
            />
          </Field>
          <Field label="Destination">
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g. Hanoi, Vietnam"
              className="w-full rounded-md border border-sand-200 px-3 py-2 text-sm outline-none ring-harbor-400 focus:ring-2"
            />
          </Field>
          <Field label="Number of days">
            <input
              type="number"
              min={1}
              value={numDays}
              onChange={(e) => setNumDays(Number(e.target.value))}
              className="w-full rounded-md border border-sand-200 px-3 py-2 text-sm outline-none ring-harbor-400 focus:ring-2"
            />
          </Field>
          <Field label="Number of nights">
            <input
              type="number"
              min={0}
              value={numNights}
              onChange={(e) => setNumNights(Number(e.target.value))}
              className="w-full rounded-md border border-sand-200 px-3 py-2 text-sm outline-none ring-harbor-400 focus:ring-2"
            />
          </Field>
        </div>

        <div className="mt-3">
          <Field label="Default notes (internal)">
            <textarea
              value={defaultNotes}
              onChange={(e) => setDefaultNotes(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-sand-200 px-3 py-2 text-sm outline-none ring-harbor-400 focus:ring-2"
            />
          </Field>
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Active — selectable when agents create a quotation
        </label>
      </section>

      <section className="rounded-lg border border-sand-200 bg-white p-5">
        <h3 className="mb-4 font-display text-sm font-semibold text-ink-900">Default itinerary</h3>
        <ItineraryBuilder days={itinerary} onChange={setItinerary} tours={tours} onTourSelected={handleTourSelected} />
      </section>

      <section className="grid grid-cols-2 gap-6">
        <div className="rounded-lg border border-sand-200 bg-white p-5">
          <h3 className="mb-2 font-display text-sm font-semibold text-ink-900">Default inclusions</h3>
          <TagListInput items={inclusions} onChange={setInclusions} placeholder="Add an inclusion…" tone="positive" />
        </div>
        <div className="rounded-lg border border-sand-200 bg-white p-5">
          <h3 className="mb-2 font-display text-sm font-semibold text-ink-900">Default exclusions</h3>
          <TagListInput items={exclusions} onChange={setExclusions} placeholder="Add an exclusion…" tone="negative" />
        </div>
      </section>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => router.push('/packages')}
          className="rounded-md border border-sand-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-sand-100"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="rounded-md bg-harbor-700 px-4 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600 disabled:opacity-60"
        >
          {isPending ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Create package'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-ink-700">{label}</label>
      {children}
    </div>
  );
}
