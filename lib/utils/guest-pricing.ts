/**
 * Guest-type and structured-cost pricing math — imported by both the
 * quotation wizard (live display while an agent builds a quote) and the
 * server-side service layer (the authoritative values actually stored and
 * put on the PDF). Using the exact same functions in both places is what
 * guarantees "the PDF total must exactly match the quotation total" rather
 * than two independent implementations that could quietly drift apart.
 *
 * Rounding policy: NONE, anywhere in this file, by explicit requirement —
 * the Excel source-of-truth this replicates has no ROUND() in its formula
 * chain either (₱58,890 and ₱63,890 shown on-screen there are just display
 * formatting; the real carried-forward values are 58,889.67 and 63,889.67).
 * Every function here returns the full, unrounded JavaScript number;
 * rounding only ever happens at display time via toLocaleString.
 */

export const GUEST_TYPES = ['senior', 'adult', 'child', 'infant', 'pwd'] as const;
export type GuestType = (typeof GUEST_TYPES)[number];

/** Default markup percentages — editable per quotation, these are just the starting values a new quotation pre-fills with. */
export const DEFAULT_AIRFARE_MARKUP_PCT = 0.1;
export const DEFAULT_HOTEL_MARKUP_PCT = 0.1;
export const DEFAULT_TRANSFER_MARKUP_PCT = 0.2;

export const GUEST_TYPE_LABELS: Record<GuestType, string> = {
  senior: 'Senior Citizen',
  adult: 'Adult',
  child: 'Child',
  infant: 'Infant / Toddler',
  pwd: 'PWD',
};

export type GuestCounts = Record<GuestType, number>;
export type GuestRates = Partial<Record<GuestType, number>>;

/** Every guest type with a quantity greater than zero — "only show/charge categories that actually apply." */
export function activeGuestTypes(counts: GuestCounts): GuestType[] {
  return GUEST_TYPES.filter((t) => (counts[t] || 0) > 0);
}

export interface GuestLineItem {
  guestType: GuestType;
  quantity: number;
  pricePerPerson: number;
  subtotal: number;
}

/** One row per active guest type, each with its own quantity × rate = subtotal — never combined with any other type's rate. */
export function buildGuestLineItems(counts: GuestCounts, rates: GuestRates): GuestLineItem[] {
  return activeGuestTypes(counts).map((guestType) => {
    const quantity = counts[guestType] || 0;
    const pricePerPerson = rates[guestType] || 0;
    return { guestType, quantity, pricePerPerson, subtotal: pricePerPerson * quantity };
  });
}

/** Total package price = sum of every active guest type's (quantity × rate). This is the only place total_price is ever computed. */
export function calculateTotalPrice(counts: GuestCounts, rates: GuestRates): number {
  return activeGuestTypes(counts).reduce((sum, t) => sum + (rates[t] || 0) * (counts[t] || 0), 0);
}

/** Same math, for the internal supplier-cost side — kept as a separate function (not a flag) since callers should never accidentally mix the two vocabularies. */
export function calculateGuestSupplierCost(counts: GuestCounts, supplierCosts: GuestRates): number {
  return calculateTotalPrice(counts, supplierCosts);
}

// ============================================================================
// Structured supplier-cost formulas. All supplier rates are entered PER
// PERSON directly by the agent — never a group total the system has to
// divide across headcount. Airfare/Hotel/Transfer each apply their own
// (editable) markup percentage directly to the per-person rate; nothing
// here derives one guest type's rate from another's.
// ============================================================================

/**
 * Airfare, Hotel, and Transfer are all structurally identical: 5
 * independently-entered per-person rates (never one derived from another),
 * with ONE shared markup percentage applied uniformly to all 5 within that
 * category. PHP 0 is a fully valid, deliberate entry (FREE) and is never
 * treated as "not entered" or backfilled from another guest type's rate.
 */
export function calculateMarkedUpRates(rates: GuestRates, markupPct: number): GuestRates {
  const result: GuestRates = {};
  for (const t of GUEST_TYPES) result[t] = (rates[t] || 0) * (1 + markupPct);
  return result;
}

/** Package per PAX = Airfare + Hotel + Transfer + every selected Tour's rate, per guest type. Unchanged formula — only what feeds into it changed. */
export function calculatePackagePerPax(
  airfareRates: GuestRates,
  hotelRates: GuestRates,
  transferRates: GuestRates,
  tourRates: GuestRates
): GuestRates {
  const result: GuestRates = {};
  for (const t of GUEST_TYPES) {
    result[t] = (airfareRates[t] || 0) + (hotelRates[t] || 0) + (transferRates[t] || 0) + (tourRates[t] || 0);
  }
  return result;
}

/** Package per PAX × the selected payment method's fee %. */
export function calculateBankFee(packagePerPax: GuestRates, feePct: number): GuestRates {
  const result: GuestRates = {};
  for (const t of GUEST_TYPES) result[t] = (packagePerPax[t] || 0) * feePct;
  return result;
}

/** Package per PAX plus its Bank Fee, added directly (never multiplied). */
export function calculateAdjustedPackage(packagePerPax: GuestRates, bankFee: GuestRates): GuestRates {
  const result: GuestRates = {};
  for (const t of GUEST_TYPES) result[t] = (packagePerPax[t] || 0) + (bankFee[t] || 0);
  return result;
}

/** Adjusted Package plus one flat Zenara Markup, identical across every guest type. */
export function calculateFinalRatePerPax(adjustedPackage: GuestRates, zenaraMarkup: number): GuestRates {
  const result: GuestRates = {};
  for (const t of GUEST_TYPES) result[t] = (adjustedPackage[t] || 0) + zenaraMarkup;
  return result;
}
