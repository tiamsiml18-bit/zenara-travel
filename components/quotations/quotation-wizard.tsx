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
  calculateMarkedUpRates,
  calculatePackagePerPax,
  calculateBankFee,
  calculateAdjustedPackage,
  calculateFinalRatePerPax,
  DEFAULT_AIRFARE_MARKUP_PCT,
  DEFAULT_HOTEL_MARKUP_PCT,
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
  tourPricing?: {
    sourceTourId: string;
    tourName: string;
    rateSenior: number | null;
    rateAdult: number | null;
    rateChild: number | null;
    rateInfant: number | null;
    ratePwd: number | null;
  }[];
  airfareAdultRate?: number;
  airfareSeniorRate?: number;
  airfareChildRate?: number;
  airfareInfantRate?: number;
  airfarePwdRate?: number;
  airfareMarkupPct?: number;
  hotelSeniorRate?: number;
  hotelAdultRate?: number;
  hotelChildRate?: number;
  hotelInfantRate?: number;
  hotelPwdRate?: number;
  hotelMarkupPct?: number;
  transferSeniorRate?: number;
  transferAdultRate?: number;
  transferChildRate?: number;
  transferInfantRate?: number;
  transferPwdRate?: number;
  transferMarkupPct?: number;
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
  defaultTransferMarkupPct,
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
  // Admin-configurable in Settings — never a hardcoded assumption about
  // what the Transfer markup should be.
  defaultTransferMarkupPct: number;
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
    // Structured supplier-cost inputs — every rate is a per-person amount
    // the agent enters directly, never a group total the system has to
    // divide. Airfare's Adult rate gets the (editable) markup applied on
    // its own; Senior/Child/Infant/PWD pass through unmarked-up, exactly
    // as entered — matching the agency's own approved pricing logic.
    // Hotel and Transfer each take a per-person rate for every guest type,
    // since suppliers sometimes do charge children/infants differently.
    airfareAdultRate: (initialData?.airfareAdultRate ?? '') as number | '',
    airfareSeniorRate: (initialData?.airfareSeniorRate ?? '') as number | '',
    airfareChildRate: (initialData?.airfareChildRate ?? '') as number | '',
    airfareInfantRate: (initialData?.airfareInfantRate ?? '') as number | '',
    airfarePwdRate: (initialData?.airfarePwdRate ?? '') as number | '',
    airfareMarkupPct: initialData?.airfareMarkupPct ?? DEFAULT_AIRFARE_MARKUP_PCT,
    hotelSeniorRate: (initialData?.hotelSeniorRate ?? '') as number | '',
    hotelAdultRate: (initialData?.hotelAdultRate ?? '') as number | '',
    hotelChildRate: (initialData?.hotelChildRate ?? '') as number | '',
    hotelInfantRate: (initialData?.hotelInfantRate ?? '') as number | '',
    hotelPwdRate: (initialData?.hotelPwdRate ?? '') as number | '',
    hotelMarkupPct: initialData?.hotelMarkupPct ?? DEFAULT_HOTEL_MARKUP_PCT,
    transferSeniorRate: (initialData?.transferSeniorRate ?? '') as number | '',
    transferAdultRate: (initialData?.transferAdultRate ?? '') as number | '',
    transferChildRate: (initialData?.transferChildRate ?? '') as number | '',
    transferInfantRate: (initialData?.transferInfantRate ?? '') as number | '',
    transferPwdRate: (initialData?.transferPwdRate ?? '') as number | '',
    transferMarkupPct: initialData?.transferMarkupPct ?? defaultTransferMarkupPct,
    paymentMethod: initialData?.paymentMethod ?? ('credit_card' as 'credit_card' | 'paypal' | 'none'),
  });
  // Per guest type — client rate AND internal supplier cost, side by side,
  // since the agent needs both to see the margin while pricing a trip.
  // Total package price is never stored as its own piece of state here —
  // it's always derived live from this plus the guest counts above (see
  // computedTotalPrice below), matching "the system calculates it
  // automatically."
  interface TourPricingRow {
    sourceTourId: string;
    tourName: string;
    rateSenior: number | '';
    rateAdult: number | '';
    rateChild: number | '';
    rateInfant: number | '';
    ratePwd: number | '';
  }
  const [tourPricing, setTourPricing] = useState<TourPricingRow[]>(
    (initialData?.tourPricing ?? []).map((t) => ({
      sourceTourId: t.sourceTourId,
      tourName: t.tourName,
      rateSenior: t.rateSenior ?? '',
      rateAdult: t.rateAdult ?? '',
      rateChild: t.rateChild ?? '',
      rateInfant: t.rateInfant ?? '',
      ratePwd: t.ratePwd ?? '',
    }))
  );
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
  const tourDestinations = Array.from(new Set(tours.map((t) => t.destination).filter((d): d is string => Boolean(d)))).sort();
  // Tour contribution only — accumulated via handleTourSelected() as tours
  // are picked in the itinerary step. Airfare/Hotel/Transfer are computed
  // separately below and combined with this, exactly matching the server's
  // computeFullPricing() so the wizard's live preview can never disagree
  // with what actually gets saved.
  // Tour contribution only — accumulated from the tourPricing list (each
  // selected Tour's own editable per-person rates for this quotation).
  // Airfare/Hotel/Transfer are computed separately below and combined with
  // this, exactly matching the server's computeFullPricing() so the
  // wizard's live preview can never disagree with what actually gets saved.
  const tourClientRateMap = GUEST_TYPES.reduce(
    (acc, t) => {
      const key = (`rate${t[0]!.toUpperCase()}${t.slice(1)}`) as keyof TourPricingRow;
      acc[t] = tourPricing.reduce((sum, row) => sum + (row[key] === '' ? 0 : Number(row[key])), 0);
      return acc;
    },
    {} as Record<GuestType, number>
  );

  const numVal = (v: number | '') => (v === '' ? 0 : Number(v));
  const computedAirfareRates = calculateMarkedUpRates(
    {
      senior: numVal(trip.airfareSeniorRate),
      adult: numVal(trip.airfareAdultRate),
      child: numVal(trip.airfareChildRate),
      infant: numVal(trip.airfareInfantRate),
      pwd: numVal(trip.airfarePwdRate),
    },
    trip.airfareMarkupPct
  );
  const computedHotelRates = calculateMarkedUpRates(
    {
      senior: numVal(trip.hotelSeniorRate),
      adult: numVal(trip.hotelAdultRate),
      child: numVal(trip.hotelChildRate),
      infant: numVal(trip.hotelInfantRate),
      pwd: numVal(trip.hotelPwdRate),
    },
    trip.hotelMarkupPct
  );
  const computedTransferRates = calculateMarkedUpRates(
    {
      senior: numVal(trip.transferSeniorRate),
      adult: numVal(trip.transferAdultRate),
      child: numVal(trip.transferChildRate),
      infant: numVal(trip.transferInfantRate),
      pwd: numVal(trip.transferPwdRate),
    },
    trip.transferMarkupPct
  );
  const computedPackagePerPax = calculatePackagePerPax(computedAirfareRates, computedHotelRates, computedTransferRates, tourClientRateMap);
  const feePct = trip.paymentMethod === 'credit_card' ? feePercentages.creditCard : trip.paymentMethod === 'paypal' ? feePercentages.paypal : 0;
  const computedBankFee = calculateBankFee(computedPackagePerPax, feePct);
  const computedAdjustedPackage = calculateAdjustedPackage(computedPackagePerPax, computedBankFee);
  const clientRateMap = calculateFinalRatePerPax(computedAdjustedPackage, numVal(trip.markup)) as Record<GuestType, number>;
  // Tours have no separate "cost vs selling price" split in the per-person
  // model — the entered rate IS the cost basis (same treatment as
  // Airfare's Senior/Child/Infant/PWD rates), so the tour contribution
  // counts once here too, reusing the same map.
  const supplierCostMap = tourClientRateMap;

  const computedTotalPrice = calculateTotalPrice(guestCounts, clientRateMap);
  const computedGuestSupplierCost = calculateGuestSupplierCost(guestCounts, supplierCostMap);
  // Internal-only total supplier cost, purely for the agent's own margin
  // visibility — sums every guest type's entered Airfare/Hotel/Transfer
  // rate (times headcount) plus itemized Other Supplier Costs plus Tours.
  const computedTotalSupplierCost =
    calculateTotalPrice(guestCounts, {
      senior: numVal(trip.airfareSeniorRate) + numVal(trip.hotelSeniorRate) + numVal(trip.transferSeniorRate),
      adult: numVal(trip.airfareAdultRate) + numVal(trip.hotelAdultRate) + numVal(trip.transferAdultRate),
      child: numVal(trip.airfareChildRate) + numVal(trip.hotelChildRate) + numVal(trip.transferChildRate),
      infant: numVal(trip.airfareInfantRate) + numVal(trip.hotelInfantRate) + numVal(trip.transferInfantRate),
      pwd: numVal(trip.airfarePwdRate) + numVal(trip.hotelPwdRate) + numVal(trip.transferPwdRate),
    }) +
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
  const [itinerary, setItinerary] = useState<ItineraryDayDraft[]>(
    // Existing days loaded from a saved quotation (edit/revise) already
    // have a real date an agent may have deliberately set — treating them
    // as "manually edited" from the start means opening an existing
    // quotation can never silently rewrite its dates. Only brand-new days
    // (added fresh in this session) start in auto-following mode.
    (initialData?.itinerary ?? []).map((d) => ({ ...d, dateManuallyEdited: d.dateManuallyEdited ?? Boolean(d.dayDate) }))
  );
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

    // One entry per unique Tour — if this exact tour is already in the
    // list (e.g. it appears on more than one itinerary day), it's never
    // added again, per "a Tour must only be counted once." Re-selecting
    // the same tour just leaves its existing (possibly agent-edited) rates
    // untouched rather than resetting them back to the library defaults.
    setTourPricing((prev) => {
      if (prev.some((t) => t.sourceTourId === tour.id)) return prev;
      return [
        ...prev,
        {
          sourceTourId: tour.id,
          tourName: tour.name,
          // Pre-filled from the Tours library as a starting point only —
          // freely editable per quotation from here on; the library row
          // itself is never modified by anything that happens in this form.
          rateSenior: tour.price_senior ?? '',
          rateAdult: tour.price_adult ?? '',
          rateChild: tour.price_child ?? '',
          rateInfant: tour.price_infant ?? '',
          ratePwd: tour.price_pwd ?? '',
        },
      ];
    });

    if (tour.group_cost) {
      setCostItems((prev) => [...prev, { label: tour.name, amount: tour.group_cost as number }]);
    }
  }

  function updateTourPricing(sourceTourId: string, patch: Partial<TourPricingRow>) {
    setTourPricing((prev) => prev.map((t) => (t.sourceTourId === sourceTourId ? { ...t, ...patch } : t)));
  }

  function removeTourPricing(sourceTourId: string) {
    setTourPricing((prev) => prev.filter((t) => t.sourceTourId !== sourceTourId));
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
    // sitting around — without this reset, picking a second package would
    // add its tours on top of the first package's, silently double-counting.
    setTourPricing([]);

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
        supplierCostPerPerson: tourClientRateMap[guestType],
      })),
      // Each selected Tour's own editable per-person rates for this
      // quotation — persisted to quotation_tour_pricing, never written
      // back to the Tours library.
      tourPricing: tourPricing.map((t) => ({
        sourceTourId: t.sourceTourId,
        tourName: t.tourName,
        rateSenior: t.rateSenior === '' ? null : Number(t.rateSenior),
        rateAdult: t.rateAdult === '' ? null : Number(t.rateAdult),
        rateChild: t.rateChild === '' ? null : Number(t.rateChild),
        rateInfant: t.rateInfant === '' ? null : Number(t.rateInfant),
        ratePwd: t.ratePwd === '' ? null : Number(t.ratePwd),
      })),
      airfareAdultRate: numVal(trip.airfareAdultRate),
      airfareSeniorRate: numVal(trip.airfareSeniorRate),
      airfareChildRate: numVal(trip.airfareChildRate),
      airfareInfantRate: numVal(trip.airfareInfantRate),
      airfarePwdRate: numVal(trip.airfarePwdRate),
      airfareMarkupPct: trip.airfareMarkupPct,
      hotelSeniorRate: numVal(trip.hotelSeniorRate),
      hotelAdultRate: numVal(trip.hotelAdultRate),
      hotelChildRate: numVal(trip.hotelChildRate),
      hotelInfantRate: numVal(trip.hotelInfantRate),
      hotelPwdRate: numVal(trip.hotelPwdRate),
      hotelMarkupPct: trip.hotelMarkupPct,
      transferSeniorRate: numVal(trip.transferSeniorRate),
      transferAdultRate: numVal(trip.transferAdultRate),
      transferChildRate: numVal(trip.transferChildRate),
      transferInfantRate: numVal(trip.transferInfantRate),
      transferPwdRate: numVal(trip.transferPwdRate),
      transferMarkupPct: trip.transferMarkupPct,
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
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-700">Airfare — Rate Per Person</p>
                    <MarkupInput value={trip.airfareMarkupPct} onChange={(v) => setTrip((t) => ({ ...t, airfareMarkupPct: v }))} />
                  </div>
                  <p className="mb-2 text-xs text-ink-500">
                    Enter each guest type's per-person supplier rate — never a group total to divide. The Adult rate
                    gets the markup above applied automatically; Senior/Child/Infant/PWD are supplier-provided and
                    used exactly as entered, never derived from the Adult rate.
                  </p>
                  <div className="grid grid-cols-5 gap-2">
                    <PriceField label="Adult" value={trip.airfareAdultRate} onChange={(v) => setTrip((t) => ({ ...t, airfareAdultRate: v }))} />
                    <PriceField label="Senior" value={trip.airfareSeniorRate} onChange={(v) => setTrip((t) => ({ ...t, airfareSeniorRate: v }))} />
                    <PriceField label="Child" value={trip.airfareChildRate} onChange={(v) => setTrip((t) => ({ ...t, airfareChildRate: v }))} />
                    <PriceField
                      label="Infant/Toddler"
                      value={trip.airfareInfantRate}
                      onChange={(v) => setTrip((t) => ({ ...t, airfareInfantRate: v }))}
                    />
                    <PriceField label="PWD" value={trip.airfarePwdRate} onChange={(v) => setTrip((t) => ({ ...t, airfarePwdRate: v }))} />
                  </div>
                  <AdjustedRateRow rates={computedAirfareRates} counts={guestCounts} />
                </div>

                {/* HOTEL */}
                <div className="rounded-md border border-sand-200 bg-white p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-700">Hotel — Rate Per Person</p>
                    <MarkupInput value={trip.hotelMarkupPct} onChange={(v) => setTrip((t) => ({ ...t, hotelMarkupPct: v }))} />
                  </div>
                  <p className="mb-2 text-xs text-ink-500">
                    Enter the per-person rate for each guest type. If every guest type pays the same, enter the same
                    amount in each field — if a supplier charges children or infants differently, enter their actual rate.
                  </p>
                  <div className="grid grid-cols-5 gap-2">
                    <PriceField label="Adult" value={trip.hotelAdultRate} onChange={(v) => setTrip((t) => ({ ...t, hotelAdultRate: v }))} />
                    <PriceField label="Senior" value={trip.hotelSeniorRate} onChange={(v) => setTrip((t) => ({ ...t, hotelSeniorRate: v }))} />
                    <PriceField label="Child" value={trip.hotelChildRate} onChange={(v) => setTrip((t) => ({ ...t, hotelChildRate: v }))} />
                    <PriceField
                      label="Infant/Toddler"
                      value={trip.hotelInfantRate}
                      onChange={(v) => setTrip((t) => ({ ...t, hotelInfantRate: v }))}
                    />
                    <PriceField label="PWD" value={trip.hotelPwdRate} onChange={(v) => setTrip((t) => ({ ...t, hotelPwdRate: v }))} />
                  </div>
                  <AdjustedRateRow rates={computedHotelRates} counts={guestCounts} />
                </div>

                {/* TRANSFER */}
                <div className="rounded-md border border-sand-200 bg-white p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-700">Transfer — Rate Per Person</p>
                    <MarkupInput value={trip.transferMarkupPct} onChange={(v) => setTrip((t) => ({ ...t, transferMarkupPct: v }))} />
                  </div>
                  <p className="mb-2 text-xs text-ink-500">
                    Include any tour-specific transfer here too — e.g. a Disneyland ticket plus its roundtrip hotel
                    transfer combine into one per-person Transfer rate for that guest type.
                  </p>
                  <div className="grid grid-cols-5 gap-2">
                    <PriceField label="Adult" value={trip.transferAdultRate} onChange={(v) => setTrip((t) => ({ ...t, transferAdultRate: v }))} />
                    <PriceField
                      label="Senior"
                      value={trip.transferSeniorRate}
                      onChange={(v) => setTrip((t) => ({ ...t, transferSeniorRate: v }))}
                    />
                    <PriceField label="Child" value={trip.transferChildRate} onChange={(v) => setTrip((t) => ({ ...t, transferChildRate: v }))} />
                    <PriceField
                      label="Infant/Toddler"
                      value={trip.transferInfantRate}
                      onChange={(v) => setTrip((t) => ({ ...t, transferInfantRate: v }))}
                    />
                    <PriceField label="PWD" value={trip.transferPwdRate} onChange={(v) => setTrip((t) => ({ ...t, transferPwdRate: v }))} />
                  </div>
                  <AdjustedRateRow rates={computedTransferRates} counts={guestCounts} />
                </div>

                {/* TOURS — one row per selected Tour, each with its own editable
                    per-person rates for this quotation only. A tour can be
                    added here directly (not only via the Itinerary step) —
                    picking one just adds its pricing row; it never creates
                    a duplicate if the same tour is already priced. Pre-filled
                    from the Tours library only as a starting point; editing
                    here never changes the library record, and there's no
                    markup on Tours — the entered rate is used as-is. */}
                <div className="rounded-md border border-sand-200 bg-white p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-700">Tours — Rate Per Person</p>
                  <p className="mb-3 text-xs text-ink-500">
                    Add a Tour directly here, or select one in the Itinerary step — either way it appears once,
                    below. No markup applies to Tours; enter each guest type's rate as the final rate.
                  </p>
                  <select
                    value=""
                    onChange={(e) => {
                      const tour = tours.find((t) => t.id === e.target.value);
                      if (tour) handleTourSelected(tour);
                      e.target.value = '';
                    }}
                    className="mb-3 w-full rounded-md border border-sand-200 bg-sand-50 px-3 py-2 text-sm outline-none ring-harbor-400 focus:ring-2"
                  >
                    <option value="">+ Add a Tour…</option>
                    {tourDestinations.map((destination) => (
                      <optgroup key={destination} label={destination}>
                        {tours
                          .filter((t) => t.destination === destination)
                          .map((t) => (
                            <option key={t.id} value={t.id} disabled={tourPricing.some((tp) => tp.sourceTourId === t.id)}>
                              {t.name}
                              {tourPricing.some((tp) => tp.sourceTourId === t.id) ? ' (already added)' : ''}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                    {tours.some((t) => !t.destination) && (
                      <optgroup label="Other">
                        {tours
                          .filter((t) => !t.destination)
                          .map((t) => (
                            <option key={t.id} value={t.id} disabled={tourPricing.some((tp) => tp.sourceTourId === t.id)}>
                              {t.name}
                              {tourPricing.some((tp) => tp.sourceTourId === t.id) ? ' (already added)' : ''}
                            </option>
                          ))}
                      </optgroup>
                    )}
                  </select>

                  {tourPricing.length === 0 ? (
                    <p className="text-xs text-ink-500">No Tours added yet.</p>
                  ) : (
                    <>
                      <div className="space-y-4">
                        {tourPricing.map((t) => (
                          <div key={t.sourceTourId} className="rounded border border-sand-100 bg-sand-50/50 p-3">
                            <div className="mb-2 flex items-center justify-between">
                              <p className="text-sm font-medium text-ink-900">{t.tourName}</p>
                              <button
                                type="button"
                                onClick={() => removeTourPricing(t.sourceTourId)}
                                className="text-xs text-coral-600 hover:underline"
                              >
                                Remove
                              </button>
                            </div>
                            <div className="grid grid-cols-5 gap-2">
                              <PriceField label="Adult" value={t.rateAdult} onChange={(v) => updateTourPricing(t.sourceTourId, { rateAdult: v })} />
                              <PriceField label="Senior" value={t.rateSenior} onChange={(v) => updateTourPricing(t.sourceTourId, { rateSenior: v })} />
                              <PriceField label="Child" value={t.rateChild} onChange={(v) => updateTourPricing(t.sourceTourId, { rateChild: v })} />
                              <PriceField
                                label="Infant/Toddler"
                                value={t.rateInfant}
                                onChange={(v) => updateTourPricing(t.sourceTourId, { rateInfant: v })}
                              />
                              <PriceField label="PWD" value={t.ratePwd} onChange={(v) => updateTourPricing(t.sourceTourId, { ratePwd: v })} />
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 space-y-1 border-t border-sand-200 pt-2">
                        {activeTypes
                          .filter((t) => tourClientRateMap[t] > 0)
                          .map((t) => (
                            <div key={t} className="flex items-center justify-between text-xs text-ink-700">
                              <span>{GUEST_TYPE_LABELS[t]} — all Tours combined</span>
                              <span className="font-ticket">PHP {tourClientRateMap[t].toLocaleString('en-PH')} / person</span>
                            </div>
                          ))}
                      </div>
                    </>
                  )}
                </div>

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
                    {/* The calculated bank fee amount per person, same treatment as Hotel/Transfer's "Adjusted Rate" preview below their inputs. */}
                    <p className="mt-2 text-xs text-ink-500">Bank fee per person</p>
                    <AdjustedRateRow rates={computedBankFee} counts={guestCounts} />
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
          <ItineraryBuilder
            days={itinerary}
            onChange={setItinerary}
            tours={tours}
            onTourSelected={handleTourSelected}
            travelStartDate={trip.travelStartDate}
          />
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
/** An editable markup percentage, e.g. "10%" — stored/passed as a fraction (0.1) but displayed and typed as a whole percent. */
function MarkupInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-ink-500">
      Markup
      <input
        type="number"
        min={0}
        step={0.1}
        value={Math.round(value * 1000) / 10}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value) / 100)}
        className="w-16 rounded-md border border-sand-200 px-2 py-1 text-right text-xs outline-none ring-harbor-400 focus:ring-2"
      />
      %
    </label>
  );
}

/** The read-only "here's what each guest type actually pays after markup" row shown below every Airfare/Hotel/Transfer entry block. */
function AdjustedRateRow({ rates, counts }: { rates: GuestRates; counts: GuestCounts }) {
  const types = activeGuestTypes(counts);
  return (
    <div className="mt-3 grid grid-cols-5 gap-2 rounded-md bg-sand-50 px-2 py-2">
      {GUEST_TYPES.map((t) =>
        types.includes(t) ? (
          <div key={t} className="text-center">
            <p className="text-[10px] uppercase tracking-wide text-ink-500">{GUEST_TYPE_LABELS[t]}</p>
            <p className="font-ticket text-xs font-semibold text-ink-900">
              PHP {(rates[t] || 0).toLocaleString('en-PH', { maximumFractionDigits: 2 })}
            </p>
          </div>
        ) : (
          <div key={t} />
        )
      )}
    </div>
  );
}

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
          placeholder="0"
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
