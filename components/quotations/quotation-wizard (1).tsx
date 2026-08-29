'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { ItineraryBuilder, type ItineraryDayDraft } from './itinerary-builder';
import { TagListInput } from './tag-list-input';
import { CostBreakdownEditor } from './cost-breakdown-editor';
import { SupplierImportPanel, type AppliedSupplierData } from './supplier-import-panel';
import {
  createQuotationDraftAction,
  reviseQuotationAction,
  getPackageDetailsAction,
} from '@/app/(app)/quotations/actions';
import { quickCreateClientAction } from '@/app/(app)/clients/actions';
import type { QuotationDraftInput, CostItemInput } from '@/lib/validation/quotation';

type Client = { id: string; full_name: string; email: string | null; mobile_number: string | null };
type PackageOption = { id: string; name: string; destination: string; num_days: number; num_nights: number };
type Source = { id: string; name: string };

const STEPS = ['Client', 'Package', 'Trip details', 'Itinerary', 'Inclusions', 'Review'] as const;

export interface QuotationWizardInitialData {
  clientId: string;
  clientLabel: string;
  destination: string;
  travelStartDate: string;
  travelEndDate: string;
  numAdults: number;
  numChildren: number;
  hotelName: string;
  numBedrooms: number;
  pricePerPerson: number | null;
  totalPrice: number;
  notes: string;
  itinerary: ItineraryDayDraft[];
  inclusions: string[];
  exclusions: string[];
  supplierCost: number; // legacy fallback (pre-itemization); costItems is the source of truth going forward
  costItems?: CostItemInput[];
  feeItems?: CostItemInput[];
  markup: number;
}

export function QuotationWizard({
  clients,
  packages,
  sources,
  initialClientId,
  mode = 'create',
  quotationId,
  initialData,
}: {
  clients: Client[];
  packages: PackageOption[];
  sources: Source[];
  initialClientId?: string;
  mode?: 'create' | 'revise';
  quotationId?: string;
  initialData?: QuotationWizardInitialData;
}) {
  const router = useRouter();
  // Revising skips the client/package steps entirely — the client and
  // original package linkage don't change on a revision, only the trip
  // content does, so we start straight at "Trip details".
  const [step, setStep] = useState(mode === 'revise' ? 2 : 0);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Step 1
  const [clientMode, setClientMode] = useState<'existing' | 'new'>('existing');
  const [clientFilter, setClientFilter] = useState('');
  const [clientId, setClientId] = useState(initialData?.clientId ?? initialClientId ?? '');
  const [newClient, setNewClient] = useState({ fullName: '', mobileNumber: '', email: '', sourceId: '' });

  // Step 2
  const [packageMode, setPackageMode] = useState<'existing' | 'custom' | 'import'>('custom');
  const [packageId, setPackageId] = useState('');

  // Step 3
  const [trip, setTrip] = useState({
    destination: initialData?.destination ?? '',
    travelStartDate: initialData?.travelStartDate ?? '',
    travelEndDate: initialData?.travelEndDate ?? '',
    numAdults: initialData?.numAdults ?? 2,
    numChildren: initialData?.numChildren ?? 0,
    hotelName: initialData?.hotelName ?? '',
    numBedrooms: initialData?.numBedrooms ?? 1,
    pricePerPerson: (initialData?.pricePerPerson ?? '') as number | '',
    totalPrice: (initialData?.totalPrice ?? '') as number | '',
    markup: (initialData?.markup ?? '') as number | '',
    notes: initialData?.notes ?? '',
  });
  const [costItems, setCostItems] = useState<CostItemInput[]>(
    initialData?.costItems ??
      // Fall back to a single legacy row if this quotation was created before
      // the itemized breakdown existed, so its cost isn't silently dropped.
      (initialData?.supplierCost ? [{ label: 'Supplier cost', amount: initialData.supplierCost }] : [])
  );
  const [feeItems, setFeeItems] = useState<CostItemInput[]>(initialData?.feeItems ?? []);
  const [showPricing, setShowPricing] = useState(false);

  // Steps 4-5
  const [itinerary, setItinerary] = useState<ItineraryDayDraft[]>(initialData?.itinerary ?? []);
  const [inclusions, setInclusions] = useState<string[]>(initialData?.inclusions ?? []);
  const [exclusions, setExclusions] = useState<string[]>(initialData?.exclusions ?? []);

  const steps = mode === 'revise' ? STEPS.slice(2) : STEPS;
  const stepOffset = mode === 'revise' ? 2 : 0;

  const filteredClients = clientFilter
    ? clients.filter((c) => c.full_name.toLowerCase().includes(clientFilter.toLowerCase()))
    : clients;

  async function handleSelectPackage(id: string) {
    setPackageId(id);
    setError(null);
    const pkg = await getPackageDetailsAction(id);
    setTrip((t) => ({ ...t, destination: pkg.package.destination }));
    setItinerary(pkg.itinerary as ItineraryDayDraft[]);
    setInclusions(pkg.inclusions);
    setExclusions(pkg.exclusions);
  }

  /**
   * Applies a reviewed supplier-URL extraction onto the draft, exactly like
   * selecting an existing package does — the agent has already edited
   * everything on the review screen inside SupplierImportPanel, so by the
   * time this runs it's just populating wizard state. Switches back to
   * 'custom' mode afterward since the applied data is now just this
   * quotation's own content, freely editable in the following steps and not
   * linked back to any package template (per spec: importing from a
   * supplier never auto-creates or modifies a package).
   */
  function handleApplySupplierData(data: AppliedSupplierData) {
    setTrip((t) => ({ ...t, destination: data.destination, notes: [t.notes, data.notes].filter(Boolean).join('\n\n') }));
    setItinerary(data.itinerary);
    setInclusions(data.inclusions);
    setExclusions(data.exclusions);
    setPackageMode('custom');
  }

  async function handleCreateInlineClient() {
    setError(null);
    if (!newClient.fullName || !newClient.sourceId) {
      setError('Full name and lead source are required.');
      return;
    }
    const result = await quickCreateClientAction(newClient);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setClientId(result.clientId);
    setStep(1);
  }

  function canAdvance(): boolean {
    if (step === 0) return Boolean(clientId);
    if (step === 1) return packageMode === 'custom' || (packageMode === 'existing' && Boolean(packageId));
    if (step === 2) {
      return Boolean(
        trip.destination && trip.travelStartDate && trip.travelEndDate && trip.numAdults > 0 && trip.totalPrice !== ''
      );
    }
    return true;
  }

  function handleSubmit() {
    setError(null);
    const input: QuotationDraftInput = {
      clientId,
      packageId: packageMode === 'existing' ? packageId : '',
      destination: trip.destination,
      travelStartDate: trip.travelStartDate,
      travelEndDate: trip.travelEndDate,
      numAdults: trip.numAdults,
      numChildren: trip.numChildren,
      hotelName: trip.hotelName,
      numBedrooms: trip.numBedrooms || null,
      pricePerPerson: trip.pricePerPerson === '' ? null : Number(trip.pricePerPerson),
      totalPrice: Number(trip.totalPrice),
      notes: trip.notes,
      inclusions,
      exclusions,
      itinerary,
      costItems,
      feeItems,
      markup: trip.markup === '' ? 0 : Number(trip.markup),
    };

    startTransition(async () => {
      const result =
        mode === 'revise' && quotationId
          ? await reviseQuotationAction(quotationId, input)
          : await createQuotationDraftAction(input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/quotations/${result.quotationId}`);
    });
  }

  return (
    <div className="max-w-3xl">
      {/* Step indicator */}
      <ol className="mb-8 flex items-center">
        {steps.map((label, localIndex) => {
          const i = localIndex + stepOffset;
          return (
            <li key={label} className="flex flex-1 items-center last:flex-none">
              <button
                type="button"
                onClick={() => i < step && i >= stepOffset && setStep(i)}
                className={clsx(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-ticket text-xs',
                  i === step
                    ? 'bg-harbor-700 text-sand-50'
                    : i < step
                      ? 'bg-harbor-100 text-harbor-700'
                      : 'bg-sand-200 text-ink-500'
                )}
              >
                {localIndex + 1}
              </button>
              <span className={clsx('ml-2 text-xs font-medium', i === step ? 'text-ink-900' : 'text-ink-500')}>
                {label}
              </span>
              {localIndex < steps.length - 1 && <span className="mx-3 h-px flex-1 bg-sand-200" />}
            </li>
          );
        })}
      </ol>

      {error && (
        <div className="mb-4 rounded-md border border-coral-500/30 bg-coral-500/5 px-3 py-2 text-sm text-coral-600">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-sand-200 bg-white p-6">
        {step === 0 && (
          <div>
            <div className="mb-4 flex gap-2">
              <TabButton active={clientMode === 'existing'} onClick={() => setClientMode('existing')}>
                Existing client
              </TabButton>
              <TabButton active={clientMode === 'new'} onClick={() => setClientMode('new')}>
                New client
              </TabButton>
            </div>

            {clientMode === 'existing' ? (
              <div>
                <input
                  value={clientFilter}
                  onChange={(e) => setClientFilter(e.target.value)}
                  placeholder="Search clients by name\u2026"
                  className="mb-3 w-full rounded-md border border-sand-200 px-3 py-2 text-sm outline-none ring-harbor-400 focus:ring-2"
                />
                <div className="max-h-64 overflow-y-auto rounded-md border border-sand-200">
                  {filteredClients.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setClientId(c.id)}
                      className={clsx(
                        'flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-sand-50',
                        clientId === c.id && 'bg-harbor-50'
                      )}
                    >
                      <span className="font-medium text-ink-900">{c.full_name}</span>
                      <span className="text-xs text-ink-500">{c.email || c.mobile_number}</span>
                    </button>
                  ))}
                  {filteredClients.length === 0 && (
                    <p className="px-3 py-4 text-sm text-ink-500">No clients match.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <LabeledInput
                  label="Full name"
                  value={newClient.fullName}
                  onChange={(v) => setNewClient((s) => ({ ...s, fullName: v }))}
                />
                <div className="grid grid-cols-2 gap-3">
                  <LabeledInput
                    label="Mobile number"
                    value={newClient.mobileNumber}
                    onChange={(v) => setNewClient((s) => ({ ...s, mobileNumber: v }))}
                  />
                  <LabeledInput
                    label="Email"
                    value={newClient.email}
                    onChange={(v) => setNewClient((s) => ({ ...s, email: v }))}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink-700">Lead source</label>
                  <select
                    value={newClient.sourceId}
                    onChange={(e) => setNewClient((s) => ({ ...s, sourceId: e.target.value }))}
                    className="w-full rounded-md border border-sand-200 px-3 py-2 text-sm"
                  >
                    <option value="">Select a source&hellip;</option>
                    {sources.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleCreateInlineClient}
                  className="rounded-md bg-harbor-700 px-4 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600"
                >
                  Create client &amp; continue
                </button>
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div>
            <div className="mb-4 flex gap-2">
              <TabButton active={packageMode === 'existing'} onClick={() => setPackageMode('existing')}>
                Existing package
              </TabButton>
              <TabButton active={packageMode === 'custom'} onClick={() => setPackageMode('custom')}>
                New custom package
              </TabButton>
              <TabButton active={packageMode === 'import'} onClick={() => setPackageMode('import')}>
                Import from supplier URL
              </TabButton>
            </div>

            {packageMode === 'existing' && (
              <div className="grid grid-cols-2 gap-3">
                {packages.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPackage(p.id)}
                    className={clsx(
                      'rounded-md border px-3 py-2.5 text-left text-sm',
                      packageId === p.id ? 'border-harbor-500 bg-harbor-50' : 'border-sand-200 hover:bg-sand-50'
                    )}
                  >
                    <p className="font-medium text-ink-900">{p.name}</p>
                    <p className="text-xs text-ink-500">
                      {p.destination} &middot; {p.num_days}D{p.num_nights}N
                    </p>
                  </button>
                ))}
                {packages.length === 0 && <p className="text-sm text-ink-500">No saved packages yet.</p>}
              </div>
            )}

            {packageMode === 'custom' && (
              <p className="text-sm text-ink-500">
                You'll build the destination, itinerary, inclusions, and exclusions manually in the next steps.
                This won't modify any existing package template.
              </p>
            )}

            {packageMode === 'import' && (
              <SupplierImportPanel onApply={handleApplySupplierData} onCancel={() => setPackageMode('custom')} />
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <LabeledInput
              label="Destination"
              value={trip.destination}
              onChange={(v) => setTrip((t) => ({ ...t, destination: v }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <LabeledInput
                label="Travel start date"
                type="date"
                value={trip.travelStartDate}
                onChange={(v) => setTrip((t) => ({ ...t, travelStartDate: v }))}
              />
              <LabeledInput
                label="Travel end date"
                type="date"
                value={trip.travelEndDate}
                onChange={(v) => setTrip((t) => ({ ...t, travelEndDate: v }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <LabeledInput
                label="Adults"
                type="number"
                value={String(trip.numAdults)}
                onChange={(v) => setTrip((t) => ({ ...t, numAdults: Number(v) }))}
              />
              <LabeledInput
                label="Children"
                type="number"
                value={String(trip.numChildren)}
                onChange={(v) => setTrip((t) => ({ ...t, numChildren: Number(v) }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <LabeledInput
                label="Hotel name"
                value={trip.hotelName}
                onChange={(v) => setTrip((t) => ({ ...t, hotelName: v }))}
              />
              <LabeledInput
                label="Number of bedrooms"
                type="number"
                value={String(trip.numBedrooms)}
                onChange={(v) => setTrip((t) => ({ ...t, numBedrooms: Number(v) }))}
              />
            </div>

            <div className="rounded-md border border-sand-200 p-4">
              <p className="mb-3 text-sm font-medium text-ink-900">Client-facing price</p>
              <div className="grid grid-cols-2 gap-3">
                <LabeledInput
                  label="Price per person (PHP)"
                  type="number"
                  value={String(trip.pricePerPerson)}
                  onChange={(v) => setTrip((t) => ({ ...t, pricePerPerson: v === '' ? '' : Number(v) }))}
                />
                <LabeledInput
                  label="Total package price (PHP)"
                  type="number"
                  value={String(trip.totalPrice)}
                  onChange={(v) => setTrip((t) => ({ ...t, totalPrice: v === '' ? '' : Number(v) }))}
                />
              </div>

              <div className="mt-4 border-t border-sand-200 pt-4">
                <p className="mb-2 text-sm font-medium text-ink-700">
                  Additional fees / taxes <span className="font-normal text-ink-500">(optional)</span>
                </p>
                <p className="mb-3 text-xs text-ink-500">
                  Shown to the client as its own section on the quotation \u2014 for a terminal fee, environmental fee,
                  VAT, or anything else worth listing separately. Leave empty if not needed.
                </p>
                <CostBreakdownEditor
                  items={feeItems}
                  onChange={setFeeItems}
                  quickAddItems={['Tax', 'Terminal fee', 'Environmental fee']}
                  totalLabel="Total additional fees"
                  customPlaceholder="Add a fee (e.g. VAT, service charge)\u2026"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowPricing((s) => !s)}
              className="text-sm font-medium text-harbor-600 hover:underline"
            >
              {showPricing ? 'Hide' : 'Show'} internal pricing (supplier cost &amp; markup)
            </button>
            {showPricing && (
              <div className="rounded-md border border-coral-500/30 bg-coral-500/5 p-4">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-coral-600">
                  Internal only \u2014 never appears on the client PDF
                </p>
                <p className="mb-3 text-sm font-medium text-ink-700">Cost breakdown</p>
                <CostBreakdownEditor items={costItems} onChange={setCostItems} />
                <div className="mt-4 border-t border-coral-500/20 pt-4">
                  <LabeledInput
                    label="Markup (PHP)"
                    type="number"
                    value={String(trip.markup)}
                    onChange={(v) => setTrip((t) => ({ ...t, markup: v === '' ? '' : Number(v) }))}
                  />
                </div>
                <ProfitPreview
                  supplierCost={costItems.reduce((sum, i) => sum + (i.amount || 0), 0)}
                  markup={trip.markup === '' ? 0 : Number(trip.markup)}
                  sellingPrice={trip.totalPrice === '' ? 0 : Number(trip.totalPrice)}
                />
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-700">Notes (internal)</label>
              <textarea
                value={trip.notes}
                onChange={(e) => setTrip((t) => ({ ...t, notes: e.target.value }))}
                rows={2}
                className="w-full rounded-md border border-sand-200 px-3 py-2 text-sm"
              />
            </div>
          </div>
        )}

        {step === 3 && <ItineraryBuilder days={itinerary} onChange={setItinerary} />}

        {step === 4 && (
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="mb-2 text-sm font-medium text-ink-900">Inclusions</p>
              <TagListInput items={inclusions} onChange={setInclusions} placeholder="Add an inclusion\u2026" tone="positive" />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-ink-900">Exclusions</p>
              <TagListInput items={exclusions} onChange={setExclusions} placeholder="Add an exclusion\u2026" tone="negative" />
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4 text-sm">
            <p className="text-ink-500">
              Review below, then save as a draft. You can edit or send it from the quotation page.
            </p>
            <ReviewRow label="Destination" value={trip.destination} />
            <ReviewRow label="Travel dates" value={`${trip.travelStartDate} \u2013 ${trip.travelEndDate}`} />
            <ReviewRow label="Guests" value={`${trip.numAdults} adults, ${trip.numChildren} children`} />
            <ReviewRow label="Hotel" value={`${trip.hotelName || '\u2014'} (${trip.numBedrooms} bedrooms)`} />
            <ReviewRow label="Itinerary days" value={String(itinerary.length)} />
            <ReviewRow label="Inclusions / Exclusions" value={`${inclusions.length} / ${exclusions.length}`} />
            <ReviewRow label="Total price" value={`PHP ${Number(trip.totalPrice || 0).toLocaleString()}`} />
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-between">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(stepOffset, s - 1))}
          disabled={step === stepOffset}
          className="rounded-md border border-sand-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-sand-100 disabled:opacity-40"
        >
          Back
        </button>

        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => canAdvance() && setStep((s) => s + 1)}
            disabled={!canAdvance()}
            className="rounded-md bg-harbor-700 px-4 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600 disabled:opacity-40"
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-md bg-harbor-700 px-4 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600 disabled:opacity-60"
          >
            {isPending ? 'Saving\u2026' : mode === 'revise' ? 'Save revision' : 'Save draft'}
          </button>
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'rounded-md px-3 py-1.5 text-sm font-medium',
        active ? 'bg-harbor-700 text-sand-50' : 'bg-sand-100 text-ink-700 hover:bg-sand-200'
      )}
    >
      {children}
    </button>
  );
}

/**
 * Live profit/margin readout while building the quote — the same math the
 * quotation detail page shows after saving (selling_price - supplier_cost),
 * surfaced here so an agent sees the effect of adjusting markup or cost
 * items immediately, without needing to save first to find out. Purely
 * client-side arithmetic for display; the actual persisted profit/margin is
 * still computed by the generated columns on quotation_pricing_internal.
 */
function ProfitPreview({
  supplierCost,
  markup,
  sellingPrice,
}: {
  supplierCost: number;
  markup: number;
  sellingPrice: number;
}) {
  const profit = sellingPrice - supplierCost;
  const margin = sellingPrice > 0 ? Math.round((profit / sellingPrice) * 1000) / 10 : 0;

  return (
    <div className="mt-4 grid grid-cols-4 gap-3 border-t border-coral-500/20 pt-4 text-center text-xs">
      <div>
        <p className="text-ink-500">Cost</p>
        <p className="font-ticket mt-0.5 font-semibold text-ink-900">PHP {supplierCost.toLocaleString('en-PH')}</p>
      </div>
      <div>
        <p className="text-ink-500">Markup</p>
        <p className="font-ticket mt-0.5 font-semibold text-ink-900">PHP {markup.toLocaleString('en-PH')}</p>
      </div>
      <div>
        <p className="text-ink-500">Profit</p>
        <p className={`font-ticket mt-0.5 font-semibold ${profit < 0 ? 'text-coral-600' : 'text-harbor-700'}`}>
          PHP {profit.toLocaleString('en-PH')}
        </p>
      </div>
      <div>
        <p className="text-ink-500">Margin</p>
        <p className={`font-ticket mt-0.5 font-semibold ${margin < 0 ? 'text-coral-600' : 'text-harbor-700'}`}>
          {margin}%
        </p>
      </div>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-ink-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-sand-200 px-3 py-2 text-sm outline-none ring-harbor-400 focus:ring-2"
      />
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-sand-100 pb-2">
      <span className="text-ink-500">{label}</span>
      <span className="font-medium text-ink-900">{value}</span>
    </div>
  );
}
