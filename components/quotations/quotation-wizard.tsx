'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { ItineraryBuilder, type ItineraryDayDraft, type TourPickerItem } from './itinerary-builder';
import { TagListInput } from './tag-list-input';
import { CostBreakdownEditor } from './cost-breakdown-editor';
import { SupplierImportPanel, type AppliedSupplierData } from './supplier-import-panel';
import {
  createQuotationDraftAction,
  reviseQuotationAction,
  updateDraftQuotationAction,
  getPackageDetailsAction,
} from '@/app/(app)/quotations/actions';
import { quickCreateClientAction } from '@/app/(app)/clients/actions';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import type { QuotationDraftInput, CostItemInput } from '@/lib/validation/quotation';
import {
  GUEST_TYPES,
  GUEST_TYPE_LABELS,
  type GuestType,
  type GuestCounts,
  type GuestRates,
  activeGuestTypes,
  calculateTotalPrice,
  calculateGuestSupplierCost,
  calculateAirfareRates,
  calculateHotelRatePerPerson,
  calculateTransferRatePerPerson,
  calculatePackagePerPax,
  calculateBankFee,
  calculateAdjustedPackage,
  calculateFinalRatePerPax,
} from '@/lib/utils/guest-pricing';

const PAYMENT_METHOD_LABELS: Record<'credit_card' | 'paypal' | 'none', string> = {
  credit_card: 'Credit Card',
  paypal: 'PayPal',
  none: 'No Fee',
};

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
  validUntil?: string;
  numAdults: number;
  numChildren: number;
  numSeniors?: number;
  numInfants?: number;
  numPwd?: number;
  hotelName: string;
  numBedrooms: number;
  guestRates?: { guestType: GuestType; pricePerPerson: number; supplierCostPerPerson: number }[];
  airfareActualRate?: number;
  airfareSeniorRate?: number;
  airfareChildRate?: number;
  airfareInfantRate?: number;
  airfarePwdRate?: number;
  hotelActualRate?: number;
  transferActualRate?: number;
  paymentMethod?: 'credit_card' | 'paypal' | 'none';
  notes: string;
  itinerary: ItineraryDayDraft[];
  inclusions: string[];
  exclusions: string[];
  supplierCost: number; // legacy fallback (pre-itemization); costItems is the source of truth going forward
  costItems?: CostItemInput[];
  feeItems?: CostItemInput[];
  consultantId?: string;
  markup: number;
}

export function QuotationWizard({
  clients,
  packages,
  sources,
  consultants,
  tours = [],
  feePercentages = { creditCard: 0.029, paypal: 0.039 },
  initialClientId,
  mode = 'create',
  quotationId,
  nextVersionLabel,
  initialData,
}: {
  clients: Client[];
  packages: PackageOption[];
  sources: Source[];
  consultants: { id: string; full_name: string }[];
  tours?: TourPickerItem[];
  // Admin-configurable (agency_settings) — passed in so the wizard's live
  // preview computes the exact same Bank Fee the server will, rather than
  // guessing at a hardcoded percentage.
  feePercentages?: { creditCard: number; paypal: number };
  initialClientId?: string;
  mode?: 'create' | 'revise' | 'edit';
  quotationId?: string;
  nextVersionLabel?: string;
  initialData?: QuotationWizardInitialData;
}) {
  const router = useRouter();
  // Revising skips the client/package steps entirely — the client and
  // original package linkage don't change on a revision, only the trip
  // content does, so we start straight at "Trip details".
  const [step, setStep] = useState(mode === 'revise' ? 2 : 0);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirmDialog();

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
    validUntil: initialData?.validUntil ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    numAdults: initialData?.numAdults ?? 2,
    numChildren: initialData?.numChildren ?? 0,
    numSeniors: initialData?.numSeniors ?? 0,
    numInfants: initialData?.numInfants ?? 0,
    numPwd: initialData?.numPwd ?? 0,
    hotelName: initialData?.hotelName ?? '',
    numBedrooms: initialData?.numBedrooms ?? 1,
    markup: (initialData?.markup ?? '') as number | '',
    notes: initialData?.notes ?? '',
    consultantId: initialData?.consultantId ?? '',
    // Structured supplier-cost inputs — replicating the agency's Excel
    // quotation exactly. Senior/Child/Infant/PWD airfare rates are manual
    // supplier-provided rates, never derived; the Adult rate is always the
    // computed remainder (see computedAirfareRates below).
    airfareActualRate: (initialData?.airfareActualRate ?? '') as number | '',
    airfareSeniorRate: (initialData?.airfareSeniorRate ?? '') as number | '',
    airfareChildRate: (initialData?.airfareChildRate ?? '') as number | '',
    airfareInfantRate: (initialData?.airfareInfantRate ?? '') as number | '',
    airfarePwdRate: (initialData?.airfarePwdRate ?? '') as number | '',
    hotelActualRate: (initialData?.hotelActualRate ?? '') as number | '',
    transferActualRate: (initialData?.transferActualRate ?? '') as number | '',
    paymentMethod: initialData?.paymentMethod ?? ('credit_card' as 'credit_card' | 'paypal' | 'none'),
  });
  // Per guest type — client rate AND internal supplier cost, side by side,
  // since the agent needs both to see the margin while pricing a trip.
  // Total package price is never stored as its own piece of state here —
  // it's always derived live from this plus the guest counts above (see
  // computedTotalPrice below), matching "the system calculates it
  // automatically."
  const [guestRates, setGuestRates] = useState<Record<GuestType, { price: number | ''; cost: number | '' }>>(() => {
    const initial: Record<GuestType, { price: number | ''; cost: number | '' }> = {
      senior: { price: '', cost: '' },
      adult: { price: '', cost: '' },
      child: { price: '', cost: '' },
      infant: { price: '', cost: '' },
      pwd: { price: '', cost: '' },
    };
    for (const r of initialData?.guestRates ?? []) {
      initial[r.guestType] = { price: r.pricePerPerson, cost: r.supplierCostPerPerson };
    }
    return initial;
  });
  const [costItems, setCostItems] = useState<CostItemInput[]>(
    initialData?.costItems ??
      // Fall back to a single legacy row if this quotation was created before
      // the itemized breakdown existed, so its cost isn't silently dropped.
      (initialData?.supplierCost ? [{ label: 'Supplier cost', amount: initialData.supplierCost }] : [])
  );
  const [feeItems, setFeeItems] = useState<CostItemInput[]>(initialData?.feeItems ?? []);

  // Derived, never stored directly as state — this is what makes "the
  // total is read-only and always correct" actually true, rather than a UI
  // convention someone could accidentally violate. Both this and the
  // server (see lib/services/quotations.ts) call the exact same
  // calculateTotalPrice() from lib/utils/guest-pricing.ts.
  const guestCounts: GuestCounts = {
    senior: trip.numSeniors,
    adult: trip.numAdults,
    child: trip.numChildren,
    infant: trip.numInfants,
    pwd: trip.numPwd,
  };
  const activeTypes = activeGuestTypes(guestCounts);
  // Tour contribution only — accumulated via handleTourSelected() as tours
  // are picked in the itinerary step. Airfare/Hotel/Transfer are computed
  // separately below and combined with this, exactly matching the server's
  // computeFullPricing() so the wizard's live preview can never disagree
  // with what actually gets saved.
  const tourClientRateMap = Object.fromEntries(
    GUEST_TYPES.map((t) => [t, guestRates[t].price === '' ? 0 : Number(guestRates[t].price)])
  ) as Record<GuestType, number>;
  const tourSupplierCostMap = Object.fromEntries(
    GUEST_TYPES.map((t) => [t, guestRates[t].cost === '' ? 0 : Number(guestRates[t].cost)])
  ) as Record<GuestType, number>;

  const numVal = (v: number | '') => (v === '' ? 0 : Number(v));
  const computedAirfareRates = calculateAirfareRates(
    {
      actualRate: numVal(trip.airfareActualRate),
      seniorRate: numVal(trip.airfareSeniorRate),
      childRate: numVal(trip.airfareChildRate),
      infantRate: numVal(trip.airfareInfantRate),
      pwdRate: numVal(trip.airfarePwdRate),
    },
    guestCounts
  );
  const computedHotelRate = calculateHotelRatePerPerson(numVal(trip.hotelActualRate), guestCounts);
  const computedTransferRate = calculateTransferRatePerPerson(numVal(trip.transferActualRate), guestCounts);
  const computedPackagePerPax = calculatePackagePerPax(computedAirfareRates, computedHotelRate, computedTransferRate, tourClientRateMap);
  const feePct = trip.paymentMethod === 'credit_card' ? feePercentages.creditCard : trip.paymentMethod === 'paypal' ? feePercentages.paypal : 0;
  const computedBankFee = calculateBankFee(computedPackagePerPax, feePct);
  const computedAdjustedPackage = calculateAdjustedPackage(computedPackagePerPax, computedBankFee);
  const clientRateMap = calculateFinalRatePerPax(computedAdjustedPackage, numVal(trip.markup)) as Record<GuestType, number>;
  const supplierCostMap = tourSupplierCostMap;

  const computedTotalPrice = calculateTotalPrice(guestCounts, clientRateMap);
  const computedGuestSupplierCost = calculateGuestSupplierCost(guestCounts, supplierCostMap);
  const computedTotalSupplierCost =
    numVal(trip.airfareActualRate) +
    numVal(trip.hotelActualRate) +
    numVal(trip.transferActualRate) +
    costItems.reduce((sum, i) => sum + (i.amount || 0), 0) +
    computedGuestSupplierCost;
  const computedProfit = computedTotalPrice - computedTotalSupplierCost;
  const computedMarginPct = computedTotalPrice > 0 ? (computedProfit / computedTotalPrice) * 100 : 0;

  // Only meaningful in revise mode — the original quotation's total,
  // recomputed the same way, purely for the "what changed" summary shown
  // before saving a revision.
  const initialTotalPrice = initialData
    ? calculateTotalPrice(
        {
          senior: initialData.numSeniors ?? 0,
          adult: initialData.numAdults,
          child: initialData.numChildren,
          infant: initialData.numInfants ?? 0,
          pwd: initialData.numPwd ?? 0,
        },
        Object.fromEntries((initialData.guestRates ?? []).map((r) => [r.guestType, r.pricePerPerson])) as Record<GuestType, number>
      )
    : 0;
  const [showPricing, setShowPricing] = useState(false);

  // Steps 4-5
  const [itinerary, setItinerary] = useState<ItineraryDayDraft[]>(initialData?.itinerary ?? []);
  const [inclusions, setInclusions] = useState<string[]>(initialData?.inclusions ?? []);
  const [exclusions, setExclusions] = useState<string[]>(initialData?.exclusions ?? []);

  /**
   * Fires when a tour is picked from any day's "Select Tour" dropdown.
   * Inclusions/exclusions get merged in (skipping exact duplicates, since
   * two tours in the same trip often share things like "hotel pickup").
   * Guest-type rates ADD to whatever's already there rather than replacing
   * it — a trip with two paid tours (e.g. Island Hopping + Sunset Cruise)
   * genuinely costs the sum of both, so accumulating is the correct
   * default; the agent can still edit any rate afterward. A tour's flat
   * group_cost (a shared cost that doesn't scale per person, like a boat
   * rental) becomes its own line in the internal cost breakdown instead of
   * a per-guest rate, since that's a different kind of cost entirely.
   */
  function handleTourSelected(tour: TourPickerItem) {
    setInclusions((prev) => Array.from(new Set([...prev, ...tour.default_inclusions])));
    setExclusions((prev) => Array.from(new Set([...prev, ...tour.default_exclusions])));

    setGuestRates((prev) => {
      const next = { ...prev };
      const addPrice = (type: GuestType, tourPrice: number | null) => {
        // PHP 0 is a valid, explicit "FREE" rate — only a genuinely
        // unconfigured (null) rate means "this tour doesn't apply to this
        // guest type." Treating 0 as falsy here would silently drop a real
        // FREE rate, which is exactly the bug this guards against.
        if (tourPrice === null || tourPrice === undefined) return;
        const current = next[type].price === '' ? 0 : Number(next[type].price);
        next[type] = { ...next[type], price: current + tourPrice };
      };
      addPrice('senior', tour.price_senior);
      addPrice('adult', tour.price_adult);
      addPrice('child', tour.price_child);
      addPrice('infant', tour.price_infant);
      addPrice('pwd', tour.price_pwd);
      return next;
    });

    if (tour.group_cost) {
      setCostItems((prev) => [...prev, { label: tour.name, amount: tour.group_cost as number }]);
    }
  }

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

    // The package's itinerary days carry sourceTourId, but that's only ever
    // used for traceability when SAVING a day — selecting the package
    // itself never re-ran the "select this tour" pricing logic, so a
    // package's tours' rates silently never made it into the quotation.
    // Fixing that here: every unique tour referenced by the package's
    // itinerary gets its pricing pulled in exactly once, matching "if the
    // Package already contains a Tour, do not add the same Tour again
    // automatically" — deduping by tour id, not by day.
    // Switching packages must not leave the previous package's tours' rates
    // sitting in the accumulator — without this reset, picking a second
    // package would add its tours on top of the first package's, silently
    // double-counting. guestRates only ever holds tour contributions (see
    // handleTourSelected), so it's always safe to clear entirely here.
    setGuestRates({
      senior: { price: '', cost: '' },
      adult: { price: '', cost: '' },
      child: { price: '', cost: '' },
      infant: { price: '', cost: '' },
      pwd: { price: '', cost: '' },
    });

    const uniqueTourIds = Array.from(
      new Set((pkg.itinerary as ItineraryDayDraft[]).map((d) => d.sourceTourId).filter((t): t is string => Boolean(t)))
    );
    for (const tourId of uniqueTourIds) {
      const tour = tours.find((t) => t.id === tourId);
      if (tour) handleTourSelected(tour);
    }
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
        trip.destination && trip.travelStartDate && trip.travelEndDate && trip.numAdults > 0 && computedTotalPrice > 0
      );
    }
    return true;
  }

  async function handleSubmit() {
    setError(null);
    const input: QuotationDraftInput = {
      clientId,
      packageId: packageMode === 'existing' ? packageId : '',
      destination: trip.destination,
      travelStartDate: trip.travelStartDate,
      travelEndDate: trip.travelEndDate,
      validUntil: trip.validUntil,
      numAdults: trip.numAdults,
      numChildren: trip.numChildren,
      numSeniors: trip.numSeniors,
      numInfants: trip.numInfants,
      numPwd: trip.numPwd,
      hotelName: trip.hotelName,
      numBedrooms: trip.numBedrooms || null,
      guestRates: activeTypes.map((guestType) => ({
        guestType,
        // Tour contribution only — the server combines this with the
        // structured Airfare/Hotel/Transfer inputs below. Sending the
        // already-final computed rate here would double-count those.
        pricePerPerson: tourClientRateMap[guestType],
        supplierCostPerPerson: tourSupplierCostMap[guestType],
      })),
      airfareActualRate: numVal(trip.airfareActualRate),
      airfareSeniorRate: numVal(trip.airfareSeniorRate),
      airfareChildRate: numVal(trip.airfareChildRate),
      airfareInfantRate: numVal(trip.airfareInfantRate),
      airfarePwdRate: numVal(trip.airfarePwdRate),
      hotelActualRate: numVal(trip.hotelActualRate),
      transferActualRate: numVal(trip.transferActualRate),
      paymentMethod: trip.paymentMethod,
      notes: trip.notes,
      consultantId: trip.consultantId,
      inclusions,
      exclusions,
      itinerary,
      costItems,
      feeItems,
      markup: trip.markup === '' ? 0 : Number(trip.markup),
    };

    // A single confirmation for the whole revision, with a short summary of
    // what actually changed — not a popup per field. Normal draft saves
    // (mode === 'create', or editing a draft in place) never hit this.
    if (mode === 'revise' && initialData) {
      const summary: { label: string; from: string; to: string }[] = [];
      const add = (label: string, from: string, to: string) => {
        if (from !== to) summary.push({ label, from, to });
      };
      add('Destination', initialData.destination, trip.destination);
      add('Travel start', initialData.travelStartDate, trip.travelStartDate);
      add('Travel end', initialData.travelEndDate, trip.travelEndDate);
      add('Hotel', initialData.hotelName || '—', trip.hotelName || '—');
      add('Total price', `PHP ${initialTotalPrice.toLocaleString('en-PH')}`, `PHP ${computedTotalPrice.toLocaleString('en-PH')}`);
      add('Itinerary days', String(initialData.itinerary?.length ?? 0), String(itinerary.length));
      add('Inclusions', String(initialData.inclusions?.length ?? 0), String(inclusions.length));
      add('Exclusions', String(initialData.exclusions?.length ?? 0), String(exclusions.length));

      const ok = await confirm({
        title: `Save this quotation as ${nextVersionLabel ?? 'a new revision'}?`,
        description: 'The original stays exactly as the client received it — this creates a new version.',
        summary,
        confirmLabel: 'Save Revision',
      });
      if (!ok) return;
    }

    startTransition(async () => {
      const result =
        mode === 'revise' && quotationId
          ? await reviseQuotationAction(quotationId, input)
          : mode === 'edit' && quotationId
            ? await updateDraftQuotationAction(quotationId, input)
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
      {dialog}
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
                  placeholder="Search clients by name…"
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
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-700">Prepared by</label>
              <select
                value={trip.consultantId}
                onChange={(e) => setTrip((t) => ({ ...t, consultantId: e.target.value }))}
                className="w-full rounded-md border border-sand-200 px-3 py-2 text-sm outline-none ring-harbor-400 focus:ring-2"
              >
                <option value="">Select who's preparing this quote…</option>
                {consultants.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-ink-500">
                Shown on the client PDF as the travel consultant — pick yourself, not whoever's logged in.
              </p>
            </div>
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
                onChange={(v) =>
                  setTrip((t) => ({
                    ...t,
                    travelStartDate: v,
                    // A blank native date input always opens its calendar
                    // on today's month, no matter what — that's the actual
                    // bug, not something React can override directly. The
                    // fix is pre-filling the end date to the start date
                    // whenever it's still empty, so its calendar opens
                    // already sitting on the right month. Never touches an
                    // end date the agent already set.
                    travelEndDate: t.travelEndDate === '' ? v : t.travelEndDate,
                  }))
                }
              />
              <LabeledInput
                label="Travel end date"
                type="date"
                value={trip.travelEndDate}
                onChange={(v) => setTrip((t) => ({ ...t, travelEndDate: v }))}
              />
            </div>
            <LabeledInput
              label="Quotation valid until"
              type="date"
              value={trip.validUntil}
              onChange={(v) => setTrip((t) => ({ ...t, validUntil: v }))}
            />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-700">Guests</label>
              <div className="grid grid-cols-5 gap-3">
                <LabeledInput
                  label="Senior citizens"
                  type="number"
                  value={String(trip.numSeniors)}
                  onChange={(v) => setTrip((t) => ({ ...t, numSeniors: Number(v) }))}
                />
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
                <LabeledInput
                  label="Infant / toddler"
                  type="number"
                  value={String(trip.numInfants)}
                  onChange={(v) => setTrip((t) => ({ ...t, numInfants: Number(v) }))}
                />
                <LabeledInput
                  label="PWD"
                  type="number"
                  value={String(trip.numPwd)}
                  onChange={(v) => setTrip((t) => ({ ...t, numPwd: Number(v) }))}
                />
              </div>
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

            {/* INTERNAL PRICING — shown first per spec. Structured Airfare/
                Hotel/Transfer inputs replicate the agency's Excel exactly;
                everything derived from them (Adult airfare rate, Hotel/
                Transfer rate per pax, Bank Fee, Total Supplier Cost, Profit,
                Margin) is read-only and computed, never typed in. */}
            <button
              type="button"
              onClick={() => setShowPricing((s) => !s)}
              className="text-sm font-medium text-harbor-600 hover:underline"
            >
              {showPricing ? 'Hide' : 'Show'} internal pricing (supplier cost &amp; markup)
            </button>
            {showPricing && (
              <div className="space-y-4 rounded-md border border-coral-500/30 bg-coral-500/5 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-coral-600">
                  Internal only — never appears on the client PDF
                </p>

                {/* AIRFARE */}
                <div className="rounded-md border border-sand-200 bg-white p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-700">Airfare</p>
                  <div className="grid grid-cols-2 gap-3">
                    <PriceField
                      label="Actual Group Rate"
                      value={trip.airfareActualRate}
                      onChange={(v) => setTrip((t) => ({ ...t, airfareActualRate: v }))}
                    />
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-ink-700">Markup</label>
                      <p className="rounded-md bg-sand-50 px-3 py-1.5 text-sm text-ink-500">10% (applied automatically)</p>
                    </div>
                  </div>
                  <p className="mb-2 mt-3 text-xs text-ink-500">
                    Senior, Child, Infant/Toddler, and PWD rates are supplier-provided — enter them as given, never
                    derived from the Adult rate.
                  </p>
                  <div className="grid grid-cols-4 gap-3">
                    <PriceField
                      label="Senior Rate"
                      value={trip.airfareSeniorRate}
                      onChange={(v) => setTrip((t) => ({ ...t, airfareSeniorRate: v }))}
                    />
                    <PriceField
                      label="Child Rate"
                      value={trip.airfareChildRate}
                      onChange={(v) => setTrip((t) => ({ ...t, airfareChildRate: v }))}
                    />
                    <PriceField
                      label="Infant/Toddler Rate"
                      value={trip.airfareInfantRate}
                      onChange={(v) => setTrip((t) => ({ ...t, airfareInfantRate: v }))}
                    />
                    <PriceField
                      label="PWD Rate"
                      value={trip.airfarePwdRate}
                      onChange={(v) => setTrip((t) => ({ ...t, airfarePwdRate: v }))}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between rounded-md bg-sand-50 px-3 py-2">
                    <span className="text-xs text-ink-500">Adult Rate (automatically calculated)</span>
                    <span className="font-ticket text-sm font-semibold text-ink-900">
                      PHP {computedAirfareRates.adult!.toLocaleString('en-PH', { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* HOTEL */}
                <div className="rounded-md border border-sand-200 bg-white p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-700">Hotel</p>
                  <div className="grid grid-cols-2 gap-3">
                    <PriceField
                      label="Actual Group Rate"
                      value={trip.hotelActualRate}
                      onChange={(v) => setTrip((t) => ({ ...t, hotelActualRate: v }))}
                    />
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-ink-700">Markup</label>
                      <p className="rounded-md bg-sand-50 px-3 py-1.5 text-sm text-ink-500">10% (applied automatically)</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between rounded-md bg-sand-50 px-3 py-2">
                    <span className="text-xs text-ink-500">Rate Per PAX (automatically calculated, same for every guest type)</span>
                    <span className="font-ticket text-sm font-semibold text-ink-900">
                      PHP {computedHotelRate.toLocaleString('en-PH', { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* TRANSFER */}
                <div className="rounded-md border border-sand-200 bg-white p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-700">Transfer</p>
                  <div className="grid grid-cols-2 gap-3">
                    <PriceField
                      label="Actual Group Rate"
                      value={trip.transferActualRate}
                      onChange={(v) => setTrip((t) => ({ ...t, transferActualRate: v }))}
                    />
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-ink-700">Markup</label>
                      <p className="rounded-md bg-sand-50 px-3 py-1.5 text-sm text-ink-500">20% (applied automatically)</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between rounded-md bg-sand-50 px-3 py-2">
                    <span className="text-xs text-ink-500">Rate Per PAX (automatically calculated, same for every guest type)</span>
                    <span className="font-ticket text-sm font-semibold text-ink-900">
                      PHP {computedTransferRate.toLocaleString('en-PH', { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* TOURS */}
                {activeTypes.some((t) => tourClientRateMap[t] > 0) && (
                  <div className="rounded-md border border-sand-200 bg-white p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-700">Tours</p>
                    <p className="mb-2 text-xs text-ink-500">
                      Pulled automatically from the Tours library as tours are selected in the Itinerary step — never
                      re-entered here.
                    </p>
                    <div className="space-y-1">
                      {activeTypes
                        .filter((t) => tourClientRateMap[t] > 0)
                        .map((t) => (
                          <div key={t} className="flex items-center justify-between text-xs text-ink-700">
                            <span>{GUEST_TYPE_LABELS[t]}</span>
                            <span className="font-ticket">PHP {tourClientRateMap[t].toLocaleString('en-PH')} / person</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* OTHER SUPPLIER COSTS */}
                <div className="rounded-md border border-sand-200 bg-white p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-700">Other Supplier Costs</p>
                  <p className="mb-2 text-xs text-ink-500">
                    Only for costs genuinely outside Airfare, Hotel, Transfer, and Tours — a visa fee, a permit, a
                    one-off request.
                  </p>
                  <CostBreakdownEditor items={costItems} onChange={setCostItems} />
                </div>

                <div className="grid grid-cols-2 gap-3 border-t border-coral-500/20 pt-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-ink-700">Payment Method</label>
                    <select
                      value={trip.paymentMethod}
                      onChange={(e) => setTrip((t) => ({ ...t, paymentMethod: e.target.value as typeof trip.paymentMethod }))}
                      className="w-full rounded-md border border-sand-200 px-3 py-2 text-sm outline-none ring-harbor-400 focus:ring-2"
                    >
                      <option value="credit_card">Credit Card ({(feePercentages.creditCard * 100).toFixed(1)}%)</option>
                      <option value="paypal">PayPal ({(feePercentages.paypal * 100).toFixed(1)}%)</option>
                      <option value="none">No Fee</option>
                    </select>
                  </div>
                  <PriceField
                    label="Zenara Markup (flat, per person)"
                    value={trip.markup}
                    onChange={(v) => setTrip((t) => ({ ...t, markup: v }))}
                  />
                </div>

                <div className="grid grid-cols-3 gap-3 border-t border-coral-500/20 pt-4 text-center">
                  <div>
                    <p className="text-xs text-ink-500">Total Supplier Cost</p>
                    <p className="font-ticket text-sm font-semibold text-ink-900">
                      PHP {computedTotalSupplierCost.toLocaleString('en-PH', { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-ink-500">Profit</p>
                    <p className={`font-ticket text-sm font-semibold ${computedProfit < 0 ? 'text-coral-600' : 'text-ink-900'}`}>
                      PHP {computedProfit.toLocaleString('en-PH', { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-ink-500">Margin</p>
                    <p className={`font-ticket text-sm font-semibold ${computedMarginPct < 0 ? 'text-coral-600' : 'text-ink-900'}`}>
                      {computedMarginPct.toFixed(2)}%
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* CLIENT-FACING PRICING — shown second, entirely computed from
                the internal pricing above. Nothing here is directly typed. */}
            <div className="rounded-md border border-sand-200 p-4">
              <p className="mb-1 text-sm font-medium text-ink-900">Client-facing price</p>
              <p className="mb-3 text-xs text-ink-500">
                Calculated automatically from Airfare, Hotel, Transfer, and Tours above — nothing here is typed in
                directly.
              </p>
              {activeTypes.length === 0 ? (
                <p className="text-xs text-ink-500">Set a guest count above first, then rates appear here.</p>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-ink-500">
                    <span>Guest type</span>
                    <span>Final rate per person</span>
                    <span className="text-right">Subtotal</span>
                  </div>
                  {activeTypes.map((guestType) => {
                    const count = guestCounts[guestType];
                    const rate = clientRateMap[guestType];
                    return (
                      <div key={guestType} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
                        <span className="text-sm text-ink-700">
                          {GUEST_TYPE_LABELS[guestType]} <span className="text-ink-500">×{count}</span>
                        </span>
                        <span className="font-ticket text-sm text-ink-700">
                          PHP {rate.toLocaleString('en-PH', { maximumFractionDigits: 2 })}
                        </span>
                        <span className="font-ticket w-28 shrink-0 text-right text-sm text-ink-700">
                          PHP {(rate * count).toLocaleString('en-PH', { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-4 flex items-center justify-between rounded-md bg-sand-50 px-3 py-2.5">
                <span className="text-sm font-medium text-ink-700">Total package price</span>
                <span className="font-ticket text-lg font-semibold text-ink-900">
                  PHP {computedTotalPrice.toLocaleString('en-PH', { maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="mt-4 border-t border-sand-200 pt-4">
                <p className="mb-2 text-sm font-medium text-ink-700">
                  Additional fees / taxes <span className="font-normal text-ink-500">(optional)</span>
                </p>
                <p className="mb-3 text-xs text-ink-500">
                  Shown to the client as its own section on the quotation — for a terminal fee, environmental fee,
                  VAT, or anything else worth listing separately. Leave empty if not needed.
                </p>
                <CostBreakdownEditor
                  items={feeItems}
                  onChange={setFeeItems}
                  quickAddItems={['Tax', 'Terminal fee', 'Environmental fee']}
                  totalLabel="Total additional fees"
                  customPlaceholder="Add a fee (e.g. VAT, service charge)…"
                />
              </div>
            </div>

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

        {step === 3 && (
          <ItineraryBuilder days={itinerary} onChange={setItinerary} tours={tours} onTourSelected={handleTourSelected} />
        )}

        {step === 4 && (
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="mb-2 text-sm font-medium text-ink-900">Inclusions</p>
              <TagListInput items={inclusions} onChange={setInclusions} placeholder="Add an inclusion…" tone="positive" />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-ink-900">Exclusions</p>
              <TagListInput items={exclusions} onChange={setExclusions} placeholder="Add an exclusion…" tone="negative" />
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4 text-sm">
            <p className="text-ink-500">
              Review below, then save as a draft. You can edit or send it from the quotation page.
            </p>
            <ReviewRow label="Destination" value={trip.destination} />
            <ReviewRow label="Travel dates" value={`${trip.travelStartDate} – ${trip.travelEndDate}`} />
            <ReviewRow
              label="Guests"
              value={[
                trip.numSeniors > 0 && `${trip.numSeniors} senior${trip.numSeniors !== 1 ? 's' : ''}`,
                `${trip.numAdults} adult${trip.numAdults !== 1 ? 's' : ''}`,
                trip.numChildren > 0 && `${trip.numChildren} child${trip.numChildren !== 1 ? 'ren' : ''}`,
                trip.numInfants > 0 && `${trip.numInfants} infant${trip.numInfants !== 1 ? 's' : ''}`,
              ]
                .filter(Boolean)
                .join(', ')}
            />
            <ReviewRow label="Hotel" value={`${trip.hotelName || '—'} (${trip.numBedrooms} bedrooms)`} />
            <ReviewRow label="Itinerary days" value={String(itinerary.length)} />
            <ReviewRow label="Inclusions / Exclusions" value={`${inclusions.length} / ${exclusions.length}`} />
            <ReviewRow label="Total price" value={`PHP ${computedTotalPrice.toLocaleString('en-PH')}`} />
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
            {isPending ? 'Saving…' : mode === 'revise' ? 'Save revision' : mode === 'edit' ? 'Save changes' : 'Save draft'}
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

/** A labeled PHP-prefixed number input, used throughout the Internal Pricing panel for every "actual rate" / manual supplier-rate field. */
function PriceField({ label, value, onChange }: { label: string; value: number | ''; onChange: (v: number | '') => void }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-ink-700">{label}</label>
      <div className="relative">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-500">PHP</span>
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          className="w-full rounded-md border border-sand-200 py-1.5 pl-9 pr-2 text-sm outline-none ring-harbor-400 focus:ring-2"
        />
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
