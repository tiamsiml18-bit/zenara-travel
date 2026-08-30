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
// Structured supplier-cost formulas — replicating the agency's Excel
// quotation template exactly (confirmed formula-by-formula against real
// cell values before implementation). See lib/services/pricing.md-equivalent
// commentary below each function for the literal Excel cell this mirrors.
// ============================================================================

export interface AirfareInputs {
  /** Agent-entered group total from the airline (Excel C9). */
  actualRate: number;
  /** Manual supplier-provided per-person rates — never derived from the Adult rate. */
  seniorRate: number;
  /** Maps to the Excel's "Toddler (2-5 y/o)" column. */
  childRate: number;
  /** Maps to the Excel's "0-2 years old" column. */
  infantRate: number;
  pwdRate: number;
}

/**
 * Excel: D9 = (C9*1.1) - ((F9*2)+G9), E9 = D9/5 — generalized here to use the
 * quotation's real guest counts instead of the two hardcoded numbers that
 * specific Excel copy happened to have for its specific trip (2 seniors, 5
 * adults). Senior/Child/Infant/PWD rates pass through completely unchanged;
 * only the Adult rate is derived — as the remainder of the marked-up total
 * once every other guest type's manually-entered cost is subtracted out.
 */
export function calculateAirfareRates(inputs: AirfareInputs, counts: GuestCounts): GuestRates {
  const markedUpTotal = inputs.actualRate * 1.1;
  const nonAdultCost =
    inputs.seniorRate * counts.senior + inputs.childRate * counts.child + inputs.infantRate * counts.infant + inputs.pwdRate * counts.pwd;
  const adultRate = counts.adult > 0 ? (markedUpTotal - nonAdultCost) / counts.adult : 0;

  return {
    senior: inputs.seniorRate,
    adult: adultRate,
    child: inputs.childRate,
    infant: inputs.infantRate,
    pwd: inputs.pwdRate,
  };
}

/**
 * Excel: D10 = C10*1.1, E10 = D10/H3, F10 = E10, G10 = F10 — Hotel is split
 * evenly across every guest type by design (kept exactly as the Excel does,
 * per explicit confirmation — no separate per-guest-type Hotel rates).
 */
export function calculateHotelRatePerPerson(actualRate: number, counts: GuestCounts): number {
  const totalPax = GUEST_TYPES.reduce((sum, t) => sum + (counts[t] || 0), 0);
  const markedUpTotal = actualRate * 1.1;
  return totalPax > 0 ? markedUpTotal / totalPax : 0;
}

/**
 * Excel: D11 = C11*1.2, E11 = D11/H3, F11 = E11, G11 = F11 — same shape as
 * Hotel (split evenly across every guest type), but a 20% adjustment
 * instead of Hotel's 10%.
 */
export function calculateTransferRatePerPerson(actualRate: number, counts: GuestCounts): number {
  const totalPax = GUEST_TYPES.reduce((sum, t) => sum + (counts[t] || 0), 0);
  const markedUpTotal = actualRate * 1.2;
  return totalPax > 0 ? markedUpTotal / totalPax : 0;
}

/** Excel: E19 = SUM(E9:E18) — Airfare + Hotel + Transfer + every selected Tour's rate, per guest type. */
export function calculatePackagePerPax(
  airfareRates: GuestRates,
  hotelRatePerPerson: number,
  transferRatePerPerson: number,
  tourRates: GuestRates
): GuestRates {
  const result: GuestRates = {};
  for (const t of GUEST_TYPES) {
    result[t] = (airfareRates[t] || 0) + hotelRatePerPerson + transferRatePerPerson + (tourRates[t] || 0);
  }
  return result;
}

/** Excel: E21 = E19*D21 — Package per PAX × the selected payment method's fee %. */
export function calculateBankFee(packagePerPax: GuestRates, feePct: number): GuestRates {
  const result: GuestRates = {};
  for (const t of GUEST_TYPES) result[t] = (packagePerPax[t] || 0) * feePct;
  return result;
}

/** Excel: E25 = E19+E21 — Package per PAX plus its Bank Fee, added directly (never multiplied). */
export function calculateAdjustedPackage(packagePerPax: GuestRates, bankFee: GuestRates): GuestRates {
  const result: GuestRates = {};
  for (const t of GUEST_TYPES) result[t] = (packagePerPax[t] || 0) + (bankFee[t] || 0);
  return result;
}

/** Excel: E29 = E25+E27 — Adjusted Package plus one flat Zenara Markup, identical across every guest type. */
export function calculateFinalRatePerPax(adjustedPackage: GuestRates, zenaraMarkup: number): GuestRates {
  const result: GuestRates = {};
  for (const t of GUEST_TYPES) result[t] = (adjustedPackage[t] || 0) + zenaraMarkup;
  return result;
}
