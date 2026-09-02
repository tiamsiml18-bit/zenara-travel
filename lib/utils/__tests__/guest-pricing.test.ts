import { describe, it, expect } from 'vitest';
import {
  calculateTotalPrice,
  calculateGuestSupplierCost,
  buildGuestLineItems,
  activeGuestTypes,
  calculateMarkedUpRates,
  calculatePackagePerPax,
  calculateBankFee,
  calculateAdjustedPackage,
  calculateFinalRatePerPax,
  type GuestCounts,
} from '@/lib/utils/guest-pricing';

const ZERO_COUNTS: GuestCounts = { senior: 0, adult: 0, child: 0, infant: 0, pwd: 0 };

describe('calculateTotalPrice — the exact examples from the spec', () => {
  it('2 Adults @ PHP 45,000 = PHP 90,000', () => {
    const counts = { ...ZERO_COUNTS, adult: 2 };
    const total = calculateTotalPrice(counts, { adult: 45000 });
    expect(total).toBe(90000);
  });

  it('2 Adults @ 45,000 + 1 Child @ 35,000 = PHP 125,000', () => {
    const counts = { ...ZERO_COUNTS, adult: 2, child: 1 };
    const total = calculateTotalPrice(counts, { adult: 45000, child: 35000 });
    expect(total).toBe(125000);
  });

  it('2 Adults @ 45,000 + 1 Infant @ 10,000 = PHP 100,000', () => {
    const counts = { ...ZERO_COUNTS, adult: 2, infant: 1 };
    const total = calculateTotalPrice(counts, { adult: 45000, infant: 10000 });
    expect(total).toBe(100000);
  });

  it('2 Adults + 1 Child + 1 Infant + 1 PWD = PHP 173,000 (all 4 categories at once)', () => {
    const counts = { ...ZERO_COUNTS, adult: 2, child: 1, infant: 1, pwd: 1 };
    const total = calculateTotalPrice(counts, { adult: 45000, child: 35000, infant: 10000, pwd: 38000 });
    expect(total).toBe(173000);
  });

  it('all 5 categories at once, including senior citizen', () => {
    const counts = { senior: 2, adult: 2, child: 1, infant: 1, pwd: 1 };
    const total = calculateTotalPrice(counts, {
      senior: 40000,
      adult: 45000,
      child: 35000,
      infant: 10000,
      pwd: 38000,
    });
    expect(total).toBe(80000 + 90000 + 35000 + 10000 + 38000);
  });

  it("never combines one guest type's rate with another's quantity", () => {
    const counts = { ...ZERO_COUNTS, adult: 2 };
    const total = calculateTotalPrice(counts, { adult: 45000, senior: 999999 });
    expect(total).toBe(90000);
  });

  it('a guest type with quantity zero contributes nothing even if a rate was typed in', () => {
    const counts = { ...ZERO_COUNTS, adult: 1, child: 0 };
    const total = calculateTotalPrice(counts, { adult: 45000, child: 35000 });
    expect(total).toBe(45000);
  });

  it('avoids floating-point drift across many small line items', () => {
    const counts = { senior: 3, adult: 7, child: 5, infant: 2, pwd: 1 };
    const total = calculateTotalPrice(counts, {
      senior: 10000.1,
      adult: 20000.2,
      child: 15000.3,
      infant: 5000.4,
      pwd: 18000.5,
    });
    const expected = 3 * 10000.1 + 7 * 20000.2 + 5 * 15000.3 + 2 * 5000.4 + 1 * 18000.5;
    expect(total).toBeCloseTo(expected, 2);
    expect(Number.isInteger(total * 100)).toBe(true);
  });

  it('an empty guest list totals to zero', () => {
    expect(calculateTotalPrice(ZERO_COUNTS, {})).toBe(0);
  });
});

describe('calculateGuestSupplierCost — same math, internal side', () => {
  it('computes total supplier cost the same way as the client-facing total', () => {
    const counts = { ...ZERO_COUNTS, adult: 2, child: 1 };
    const cost = calculateGuestSupplierCost(counts, { adult: 35000, child: 25000 });
    expect(cost).toBe(95000);
  });
});

describe('activeGuestTypes — only categories with quantity > 0', () => {
  it('returns only guest types actually present', () => {
    const counts = { ...ZERO_COUNTS, adult: 2, infant: 1 };
    expect(activeGuestTypes(counts)).toEqual(['adult', 'infant']);
  });

  it('returns an empty list when every count is zero', () => {
    expect(activeGuestTypes(ZERO_COUNTS)).toEqual([]);
  });
});

describe('buildGuestLineItems — one row per active guest type, never combined', () => {
  it('produces exactly one line per active type with its own subtotal', () => {
    const counts = { ...ZERO_COUNTS, adult: 2, child: 1, infant: 1 };
    const lines = buildGuestLineItems(counts, { adult: 45000, child: 35000, infant: 10000 });
    expect(lines).toEqual([
      { guestType: 'adult', quantity: 2, pricePerPerson: 45000, subtotal: 90000 },
      { guestType: 'child', quantity: 1, pricePerPerson: 35000, subtotal: 35000 },
      { guestType: 'infant', quantity: 1, pricePerPerson: 10000, subtotal: 10000 },
    ]);
  });

  it('orders Adult before Senior — matching every input field\'s own order throughout the wizard and PDF, not GUEST_TYPES\' internal Senior-first calculation order', () => {
    const counts = { senior: 2, adult: 5, child: 1, infant: 0, pwd: 0 };
    const lines = buildGuestLineItems(counts, { senior: 40000, adult: 45000, child: 35000 });
    expect(lines.map((l) => l.guestType)).toEqual(['adult', 'senior', 'child']);
  });

  it('omits guest types with zero quantity entirely, even with a rate set', () => {
    const counts = { ...ZERO_COUNTS, adult: 2 };
    const lines = buildGuestLineItems(counts, { adult: 45000, senior: 40000 });
    expect(lines).toHaveLength(1);
    expect(lines[0]?.guestType).toBe('adult');
  });
});

// ============================================================================
// Per-person pricing model — every supplier rate is entered directly per
// person by the agent (never a group total the system divides). Airfare,
// Hotel, and Transfer each apply their own markup directly to the entered
// rate. The downstream chain (Package per PAX -> Bank Fee -> Adjusted
// Package -> Final Rate per PAX) is UNCHANGED from the previous Excel-based
// model — only what feeds into Package per PAX changed, so those tests
// below reuse the same previously-verified numbers.
// ============================================================================
describe('calculateMarkedUpRates — shared by Airfare (10%), Hotel (10%), and Transfer (admin-configurable) — each guest type independently entered, one shared markup applied uniformly', () => {
  it('matches the spec Airfare example exactly: PHP 20,000 supplier + 10% = PHP 22,000', () => {
    const rates = calculateMarkedUpRates({ adult: 20000 }, 0.1);
    expect(rates.adult).toBe(22000);
  });

  it('Senior/Child/Infant/PWD are each independently entered and get the SAME shared markup — never derived from Adult, never left unmarked-up', () => {
    const rates = calculateMarkedUpRates({ adult: 23280, senior: 19000, child: 15000, infant: 0, pwd: 19000 }, 0.1);
    expect(rates.senior).toBeCloseTo(20900, 6); // 19,000 * 1.1
    expect(rates.child).toBeCloseTo(16500, 6); // 15,000 * 1.1
    expect(rates.infant).toBe(0); // a real, valid FREE rate — 0 * 1.1 is still 0, never falls back to another type's rate
    expect(rates.pwd).toBeCloseTo(20900, 6);
  });
});

describe('calculateMarkedUpRates — Hotel/Transfer, each guest type independent', () => {
  it('matches the spec Hotel example: PHP 10,000 + 10% = PHP 11,000', () => {
    const rates = calculateMarkedUpRates({ adult: 10000 }, 0.1);
    expect(rates.adult).toBe(11000);
  });

  it('matches the spec Transfer example: PHP 2,000 + 20% = PHP 2,400', () => {
    const rates = calculateMarkedUpRates({ adult: 2000 }, 0.2);
    expect(rates.adult).toBe(2400);
  });

  it('allows genuinely different per-guest-type rates (Option 2) — a child hotel rate can differ from the adult rate', () => {
    const rates = calculateMarkedUpRates({ adult: 12650, senior: 12650, child: 10000, infant: 0, pwd: 10000 }, 0.1);
    expect(rates.adult).toBeCloseTo(13915, 6);
    expect(rates.child).toBeCloseTo(11000, 6);
    expect(rates.infant).toBe(0); // FREE is valid and never inherits the adult rate
    expect(rates.pwd).toBeCloseTo(11000, 6);
  });
});

// ============================================================================
// Downstream chain regression tests — Package per PAX through Final Rate
// per PAX are UNCHANGED formulas from the previously Excel-verified model,
// reusing the exact same previously-verified numbers to prove the rewrite
// didn't silently alter anything downstream of the input stage.
// ============================================================================
describe('Downstream pricing chain — unchanged since the input-stage rewrite', () => {
  it('Land Arrangement Only excludes Airfare from Package per PAX by omitting it from the sum, not by a separate flag or field', () => {
    const airfareRates = { adult: 20000, senior: 18000 };
    const hotelRates = { adult: 5000, senior: 5000 };
    const transferRates = { adult: 1000, senior: 1000 };
    const tourRates = { adult: 500, senior: 500 };

    const allIn = calculatePackagePerPax(airfareRates, hotelRates, transferRates, tourRates);
    const landArrangementOnly = calculatePackagePerPax({}, hotelRates, transferRates, tourRates);

    // All-In includes the full airfare rate in the sum.
    expect(allIn.adult).toBe(26500); // 20000 + 5000 + 1000 + 500
    // Land Arrangement Only excludes exactly the airfare portion — every
    // other component (hotel, transfer, tours) is completely unaffected.
    expect(landArrangementOnly.adult).toBe(6500); // 5000 + 1000 + 500
    expect(allIn.adult - landArrangementOnly.adult).toBe(airfareRates.adult);
  });

  it('Package per PAX includes Other Supplier Costs as a genuine per-guest-type contribution, not just an internal cost total', () => {
    const airfareRates = calculateMarkedUpRates({ adult: 1000 }, 0);
    const hotelRates = calculateMarkedUpRates({ adult: 500 }, 0);
    const transferRates = calculateMarkedUpRates({ adult: 200 }, 0);
    const tourRates = { adult: 300 };
    const otherCostRates = { adult: 1000 }; // e.g. a Visa Fee
    const withOtherCosts = calculatePackagePerPax(airfareRates, hotelRates, transferRates, tourRates, otherCostRates);
    const withoutOtherCosts = calculatePackagePerPax(airfareRates, hotelRates, transferRates, tourRates);
    expect(withOtherCosts.adult).toBe(3000); // 1000 + 500 + 200 + 300 + 1000
    expect(withoutOtherCosts.adult).toBe(2000); // confirms it's additive, not silently ignored when provided
  });

  it('Package per PAX = Airfare + Hotel + Transfer + Tours, per guest type', () => {
    const airfareRates = calculateMarkedUpRates({ senior: 19000, adult: 23280, child: 15000, infant: 0, pwd: 0 }, 0);
    const hotelRates = calculateMarkedUpRates({ adult: 12650, senior: 12650, child: 12650, infant: 12650, pwd: 12650 }, 0);
    const transferRates = calculateMarkedUpRates({ adult: 1800, senior: 1800, child: 1800, infant: 1800, pwd: 1800 }, 0);
    const tourRates = { senior: 5000 + 8500 + 4000, adult: 5500 + 9500 + 4500, child: 1500 + 2500 + 0, infant: 0, pwd: 0 };
    const packagePerPax = calculatePackagePerPax(airfareRates, hotelRates, transferRates, tourRates);

    expect(packagePerPax.adult).toBeCloseTo(57230, 6);
    expect(packagePerPax.senior).toBeCloseTo(50950, 6);
    expect(packagePerPax.child).toBeCloseTo(33450, 6);
  });

  it('Bank Fee: Package per PAX × 2.9%', () => {
    const bankFee = calculateBankFee({ adult: 57230, senior: 50950, child: 33450, infant: 0, pwd: 0 }, 0.029);
    expect(bankFee.adult).toBeCloseTo(1659.67, 2);
    expect(bankFee.senior).toBeCloseTo(1477.55, 2);
    expect(bankFee.child).toBeCloseTo(970.05, 2);
  });

  it('Adjusted Package: Package + Bank Fee, unrounded', () => {
    const adjusted = calculateAdjustedPackage(
      { adult: 57230, senior: 50950, child: 33450, infant: 0, pwd: 0 },
      { adult: 1659.67, senior: 1477.55, child: 970.05, infant: 0, pwd: 0 }
    );
    expect(adjusted.adult).toBeCloseTo(58889.67, 2);
    expect(adjusted.senior).toBeCloseTo(52427.55, 2);
    expect(adjusted.child).toBeCloseTo(34420.05, 2);
  });

  it('Final Rate per PAX: Adjusted Package + flat ₱5,000 Zenara Markup', () => {
    const final = calculateFinalRatePerPax(
      { adult: 58889.67, senior: 52427.55, child: 34420.05, infant: 0, pwd: 0 },
      5000
    );
    expect(final.adult).toBeCloseTo(63889.67, 2);
    expect(final.senior).toBeCloseTo(57427.55, 2);
    expect(final.child).toBeCloseTo(39420.05, 2);
  });

  it('never rounds mid-calculation — the full unrounded decimal survives every step', () => {
    const bankFee = calculateBankFee({ adult: 57230, senior: 0, child: 0, infant: 0, pwd: 0 }, 0.029);
    const adjusted = calculateAdjustedPackage({ adult: 57230, senior: 0, child: 0, infant: 0, pwd: 0 }, bankFee);
    expect(adjusted.adult).not.toBe(58890); // not silently rounded to the display value
    expect(adjusted.adult).toBeCloseTo(58889.67, 2);
  });
});

// ============================================================================
// PHP 0 is a valid, explicit "FREE" rate — never a missing value, and never
// silently replaced by another guest type's rate. Regression coverage for
// the exact bug flagged: a tour selection handler treating `0` as falsy and
// skipping it entirely, or any code path inheriting the Adult rate for an
// unconfigured Infant/Toddler rate.
// ============================================================================
describe('PHP 0 (FREE) is a valid rate, distinct from "not configured"', () => {
  it('includes a guest type priced at exactly 0 in the line items, not omitted', () => {
    const counts = { senior: 0, adult: 2, child: 0, infant: 1, pwd: 0 };
    const lines = buildGuestLineItems(counts, { adult: 6600, infant: 0 });
    const infantLine = lines.find((l) => l.guestType === 'infant');
    expect(infantLine).toBeDefined();
    expect(infantLine?.pricePerPerson).toBe(0);
    expect(infantLine?.subtotal).toBe(0);
  });

  it('a FREE (0) rate contributes exactly 0 to the total, never the Adult rate', () => {
    const counts = { senior: 0, adult: 2, child: 0, infant: 1, pwd: 0 };
    // Adult 6,600 x2 + Infant FREE x1 = 13,200 total, never 6,600 x3 = 19,800
    const total = calculateTotalPrice(counts, { adult: 6600, infant: 0 });
    expect(total).toBe(13200);
  });

  it('an unset (undefined) rate defaults to 0 in the total, same numeric outcome as an explicit 0 — but the two remain distinguishable at the data level (undefined vs 0) for anyone inspecting the raw rate', () => {
    const counts = { senior: 0, adult: 2, child: 0, infant: 1, pwd: 0 };
    const totalWithExplicitZero = calculateTotalPrice(counts, { adult: 6600, infant: 0 });
    const totalWithUnsetRate = calculateTotalPrice(counts, { adult: 6600 });
    expect(totalWithExplicitZero).toBe(totalWithUnsetRate);
  });
});
