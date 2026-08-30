import { describe, it, expect } from 'vitest';
import {
  calculateTotalPrice,
  calculateGuestSupplierCost,
  buildGuestLineItems,
  activeGuestTypes,
  calculateAirfareRates,
  calculateHotelRatePerPerson,
  calculateTransferRatePerPerson,
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

  it('omits guest types with zero quantity entirely, even with a rate set', () => {
    const counts = { ...ZERO_COUNTS, adult: 2 };
    const lines = buildGuestLineItems(counts, { adult: 45000, senior: 40000 });
    expect(lines).toHaveLength(1);
    expect(lines[0]?.guestType).toBe('adult');
  });
});

// ============================================================================
// Real-data regression tests — the Japan / Patricia Ruth quotation, taken
// directly from the agency's actual Excel template (5 Adults, 2 Seniors,
// 1 Child/Toddler, 0 Infant). Every expected value below is the literal
// cached value read out of that spreadsheet's cells, not a hand-computed
// guess — if these ever fail, the app has drifted from the Excel source of
// truth, which is exactly what this test suite exists to catch.
// ============================================================================
describe('Excel parity — Japan / Patricia Ruth quotation (5 Adults, 2 Seniors, 1 Child)', () => {
  const counts: GuestCounts = { senior: 2, adult: 5, child: 1, infant: 0, pwd: 0 };

  it('Airfare: Excel D9/E9 — (154,000 × 1.10) − (19,000×2 + 15,000) ÷ 5 adults = 23,280', () => {
    const rates = calculateAirfareRates(
      { actualRate: 154000, seniorRate: 19000, childRate: 15000, infantRate: 0, pwdRate: 0 },
      counts
    );
    expect(rates.adult).toBe(23280);
    expect(rates.senior).toBe(19000); // passed through unchanged, never derived
    expect(rates.child).toBe(15000);
  });

  it('Hotel: Excel D10/E10 — (92,000 × 1.10) ÷ 8 total pax = 12,650, same for every guest type', () => {
    const rate = calculateHotelRatePerPerson(92000, counts);
    expect(rate).toBeCloseTo(12650, 6);
  });

  it('Transfer: Excel D11/E11 — (12,000 × 1.20) ÷ 8 total pax = 1,800', () => {
    const rate = calculateTransferRatePerPerson(12000, counts);
    expect(rate).toBe(1800);
  });

  it('Package per PAX: Excel E19/F19/G19 — Airfare + Hotel + Transfer + 3 Tours, per guest type', () => {
    const airfareRates = calculateAirfareRates(
      { actualRate: 154000, seniorRate: 19000, childRate: 15000, infantRate: 0, pwdRate: 0 },
      counts
    );
    const hotelRate = calculateHotelRatePerPerson(92000, counts);
    const transferRate = calculateTransferRatePerPerson(12000, counts);
    // Mt. Fuji (5500/5000/1500) + Disneyland (9500/8500/2500) + Kamakura (4500/4000/0)
    const tourRates = { senior: 5000 + 8500 + 4000, adult: 5500 + 9500 + 4500, child: 1500 + 2500 + 0, infant: 0, pwd: 0 };
    const packagePerPax = calculatePackagePerPax(airfareRates, hotelRate, transferRate, tourRates);

    expect(packagePerPax.adult).toBeCloseTo(57230, 6);
    expect(packagePerPax.senior).toBeCloseTo(50950, 6);
    expect(packagePerPax.child).toBeCloseTo(33450, 6);
  });

  it('Bank Fee: Excel E21/F21/G21 — Package per PAX × 2.9%', () => {
    const bankFee = calculateBankFee({ adult: 57230, senior: 50950, child: 33450, infant: 0, pwd: 0 }, 0.029);
    expect(bankFee.adult).toBeCloseTo(1659.67, 2);
    expect(bankFee.senior).toBeCloseTo(1477.55, 2);
    expect(bankFee.child).toBeCloseTo(970.05, 2);
  });

  it('Adjusted Package: Excel E25/F25/G25 — Package + Bank Fee, unrounded', () => {
    const adjusted = calculateAdjustedPackage(
      { adult: 57230, senior: 50950, child: 33450, infant: 0, pwd: 0 },
      { adult: 1659.67, senior: 1477.55, child: 970.05, infant: 0, pwd: 0 }
    );
    expect(adjusted.adult).toBeCloseTo(58889.67, 2);
    expect(adjusted.senior).toBeCloseTo(52427.55, 2);
    expect(adjusted.child).toBeCloseTo(34420.05, 2);
  });

  it('Final Rate per PAX: Excel E29/F29/G29 — Adjusted Package + flat ₱5,000 Zenara Markup', () => {
    const final = calculateFinalRatePerPax(
      { adult: 58889.67, senior: 52427.55, child: 34420.05, infant: 0, pwd: 0 },
      5000
    );
    expect(final.adult).toBeCloseTo(63889.67, 2);
    expect(final.senior).toBeCloseTo(57427.55, 2);
    expect(final.child).toBeCloseTo(39420.05, 2);
  });

  it('never rounds mid-calculation — the full unrounded decimal survives every step', () => {
    // The Excel displays 58,890 and 63,890 (rounded for display only); the
    // real carried-forward values are 58,889.67 and 63,889.67. Confirming
    // the app's chain preserves that same unrounded precision throughout.
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
