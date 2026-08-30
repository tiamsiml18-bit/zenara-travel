/**
 * Guest-type pricing math — imported by both the quotation wizard (for the
 * live, read-only total shown while an agent is building a quote) and the
 * server-side service layer (for the authoritative value actually stored
 * and put on the PDF). Using the exact same function in both places is what
 * guarantees "the PDF total must exactly match the quotation total" rather
 * than two independent implementations that could quietly drift apart.
 *
 * Currency math is done in integer cents, not floating-point pesos, per the
 * accuracy requirement — summing many small floating-point multiplications
 * (rate × quantity, repeated per guest type, repeated across cost + selling
 * price) is exactly the kind of chain that can accumulate visible rounding
 * error; integer cents can't.
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

function toCents(pesos: number): number {
  return Math.round((pesos || 0) * 100);
}
function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

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
    return { guestType, quantity, pricePerPerson, subtotal: fromCents(toCents(pricePerPerson) * quantity) };
  });
}

/** Total package price = sum of every active guest type's (quantity × rate). This is the only place total_price is ever computed. */
export function calculateTotalPrice(counts: GuestCounts, rates: GuestRates): number {
  const totalCents = activeGuestTypes(counts).reduce((sum, t) => sum + toCents(rates[t] || 0) * (counts[t] || 0), 0);
  return fromCents(totalCents);
}

/** Same math, for the internal supplier-cost side — kept as a separate function (not a flag) since callers should never accidentally mix the two vocabularies. */
export function calculateGuestSupplierCost(counts: GuestCounts, supplierCosts: GuestRates): number {
  return calculateTotalPrice(counts, supplierCosts);
}
