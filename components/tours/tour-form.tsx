'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { TagListInput } from '@/components/quotations/tag-list-input';
import { createTourAction, updateTourAction } from '@/app/(app)/tours/actions';
import type { TourFormInput } from '@/lib/validation/tour';

export interface TourFormInitialData {
  name: string;
  destination: string;
  description: string;
  activities: string[];
  defaultInclusions: string[];
  defaultExclusions: string[];
  priceSenior: number | null;
  priceAdult: number | null;
  priceChild: number | null;
  priceInfant: number | null;
  pricePwd: number | null;
  groupCost: number | null;
  ageRangeSenior: string;
  ageRangeAdult: string;
  ageRangeChild: string;
  ageRangeInfant: string;
  ageRangePwd: string;
  tourTypes: ('all_in' | 'land_arrangement')[];
}

export function TourForm({
  mode = 'create',
  tourId,
  initialData,
}: {
  mode?: 'create' | 'edit';
  tourId?: string;
  initialData?: TourFormInitialData;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initialData?.name ?? '');
  const [destination, setDestination] = useState(initialData?.destination ?? '');
  const [tourTypes, setTourTypes] = useState<Set<'all_in' | 'land_arrangement'>>(new Set(initialData?.tourTypes ?? []));
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [activities, setActivities] = useState<string[]>(initialData?.activities ?? []);
  const [defaultInclusions, setDefaultInclusions] = useState<string[]>(initialData?.defaultInclusions ?? []);
  const [defaultExclusions, setDefaultExclusions] = useState<string[]>(initialData?.defaultExclusions ?? []);
  const [priceSenior, setPriceSenior] = useState<number | ''>(initialData?.priceSenior ?? '');
  const [priceAdult, setPriceAdult] = useState<number | ''>(initialData?.priceAdult ?? '');
  const [priceChild, setPriceChild] = useState<number | ''>(initialData?.priceChild ?? '');
  const [priceInfant, setPriceInfant] = useState<number | ''>(initialData?.priceInfant ?? '');
  const [pricePwd, setPricePwd] = useState<number | ''>(initialData?.pricePwd ?? '');
  const [groupCost, setGroupCost] = useState<number | ''>(initialData?.groupCost ?? '');
  const [ageRangeSenior, setAgeRangeSenior] = useState(initialData?.ageRangeSenior ?? '');
  const [ageRangeAdult, setAgeRangeAdult] = useState(initialData?.ageRangeAdult ?? '');
  const [ageRangeChild, setAgeRangeChild] = useState(initialData?.ageRangeChild ?? '');
  const [ageRangeInfant, setAgeRangeInfant] = useState(initialData?.ageRangeInfant ?? '');
  const [ageRangePwd, setAgeRangePwd] = useState(initialData?.ageRangePwd ?? '');

  function handleSubmit() {
    setError(null);
    const input: TourFormInput = {
      name,
      destination,
      description,
      activities,
      defaultInclusions,
      defaultExclusions,
      priceSenior: priceSenior === '' ? null : Number(priceSenior),
      priceAdult: priceAdult === '' ? null : Number(priceAdult),
      priceChild: priceChild === '' ? null : Number(priceChild),
      priceInfant: priceInfant === '' ? null : Number(priceInfant),
      pricePwd: pricePwd === '' ? null : Number(pricePwd),
      groupCost: groupCost === '' ? null : Number(groupCost),
      ageRangeSenior,
      ageRangeAdult,
      ageRangeChild,
      ageRangeInfant,
      ageRangePwd,
      tourTypes: Array.from(tourTypes),
    };

    startTransition(async () => {
      const result = mode === 'edit' && tourId ? await updateTourAction(tourId, input) : await createTourAction(input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/tours/${result.tourId}`);
    });
  }

  return (
    <div className="max-w-2xl space-y-6">
      {error && <div className="rounded-md border border-coral-500/30 bg-coral-500/5 px-4 py-3 text-sm text-coral-600">{error}</div>}

      <div className="rounded-lg border border-sand-200 bg-white p-4">
        <p className="mb-3 text-sm font-medium text-ink-900">Tour details</p>
        <div className="space-y-3">
          <LabeledInput label="Tour name" value={name} onChange={setName} required />
          <div className="grid grid-cols-2 gap-3">
            <LabeledInput label="Destination" value={destination} onChange={setDestination} />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-700">Tour type</label>
              <div className="flex h-[38px] items-center gap-4 rounded-md border border-sand-200 px-3">
                <label className="flex items-center gap-1.5 text-sm text-ink-700">
                  <input
                    type="checkbox"
                    checked={tourTypes.has('all_in')}
                    onChange={(e) =>
                      setTourTypes((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add('all_in');
                        else next.delete('all_in');
                        return next;
                      })
                    }
                  />
                  All-In
                </label>
                <label className="flex items-center gap-1.5 text-sm text-ink-700">
                  <input
                    type="checkbox"
                    checked={tourTypes.has('land_arrangement')}
                    onChange={(e) =>
                      setTourTypes((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add('land_arrangement');
                        else next.delete('land_arrangement');
                        return next;
                      })
                    }
                  />
                  Land Arrangement
                </label>
              </div>
              {/* Both boxes can be checked at once — the same tour then
                  shows up under either filter on the Tours page, no
                  duplicate record needed. */}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional short description shown to staff, not the client…"
              className="w-full rounded-md border border-sand-200 px-3 py-1.5 text-sm outline-none ring-harbor-400 focus:ring-2"
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-sand-200 bg-white p-4">
        <p className="mb-3 text-sm font-medium text-ink-900">Activities</p>
        <p className="mb-2 text-xs text-ink-500">These populate the itinerary day when this tour is selected in a quotation or package.</p>
        <TagListInput items={activities} onChange={setActivities} placeholder="Add an activity, e.g. Puka Beach…" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-sand-200 bg-white p-4">
          <p className="mb-2 text-sm font-medium text-ink-900">Default inclusions</p>
          <TagListInput items={defaultInclusions} onChange={setDefaultInclusions} placeholder="Add an inclusion…" tone="positive" />
        </div>
        <div className="rounded-lg border border-sand-200 bg-white p-4">
          <p className="mb-2 text-sm font-medium text-ink-900">Default exclusions</p>
          <TagListInput items={defaultExclusions} onChange={setDefaultExclusions} placeholder="Add an exclusion…" tone="negative" />
        </div>
      </div>

      <div className="rounded-lg border border-sand-200 bg-white p-4">
        <p className="mb-1 text-sm font-medium text-ink-900">Default pricing</p>
        <p className="mb-3 text-xs text-ink-500">
          Copied into a quotation's rates when this tour is selected — the agent can still adjust it for that specific quotation
          without changing this master rate. Leave a rate blank if this tour genuinely doesn't apply to that guest type;
          enter <strong>0</strong> if it's free for them — the two are treated differently, and a blank rate is never
          copied from another guest type's rate.
        </p>
        <div className="space-y-3">
          <PriceWithAgeRow label="Senior citizen" price={priceSenior} onPriceChange={setPriceSenior} ageRange={ageRangeSenior} onAgeRangeChange={setAgeRangeSenior} />
          <PriceWithAgeRow label="Adult" price={priceAdult} onPriceChange={setPriceAdult} ageRange={ageRangeAdult} onAgeRangeChange={setAgeRangeAdult} />
          <PriceWithAgeRow label="Child" price={priceChild} onPriceChange={setPriceChild} ageRange={ageRangeChild} onAgeRangeChange={setAgeRangeChild} />
          <PriceWithAgeRow label="Infant / toddler" price={priceInfant} onPriceChange={setPriceInfant} ageRange={ageRangeInfant} onAgeRangeChange={setAgeRangeInfant} />
          <PriceWithAgeRow label="PWD" price={pricePwd} onPriceChange={setPricePwd} ageRange={ageRangePwd} onAgeRangeChange={setAgeRangePwd} />
        </div>
        <div className="mt-4 border-t border-sand-200 pt-4">
          <PriceInput
            label="Shared / group cost (optional)"
            value={groupCost}
            onChange={setGroupCost}
            hint="A flat cost that doesn't scale per person, e.g. a boat rental."
          />
        </div>
      </div>

      <button
        type="button"
        disabled={isPending || !name.trim()}
        onClick={handleSubmit}
        className="rounded-md bg-harbor-700 px-5 py-2.5 text-sm font-medium text-sand-50 hover:bg-harbor-600 disabled:opacity-50"
      >
        {isPending ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Create tour'}
      </button>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-ink-700">
        {label} {required && <span className="text-coral-500">*</span>}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-sand-200 px-3 py-1.5 text-sm outline-none ring-harbor-400 focus:ring-2"
      />
    </div>
  );
}

function PriceWithAgeRow({
  label,
  price,
  onPriceChange,
  ageRange,
  onAgeRangeChange,
}: {
  label: string;
  price: number | '';
  onPriceChange: (v: number | '') => void;
  ageRange: string;
  onAgeRangeChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
      <PriceInput label={label} value={price} onChange={onPriceChange} />
      <span className="pb-2 text-xs text-ink-500">age range</span>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-ink-700">Age range (optional label)</label>
        <input
          value={ageRange}
          onChange={(e) => onAgeRangeChange(e.target.value)}
          placeholder="e.g. 3-11 years"
          className="w-full rounded-md border border-sand-200 px-3 py-1.5 text-sm outline-none ring-harbor-400 focus:ring-2"
        />
      </div>
    </div>
  );
}

function PriceInput({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number | '';
  onChange: (v: number | '') => void;
  hint?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-ink-700">{label}</label>
      <div className="relative">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-500">PHP</span>
        <input
          type="number"
          min={0}
          value={value}
          placeholder="0"
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          className="w-full rounded-md border border-sand-200 py-1.5 pl-9 pr-2 text-sm outline-none ring-harbor-400 focus:ring-2"
        />
      </div>
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
    </div>
  );
}
