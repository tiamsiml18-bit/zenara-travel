import { describe, it, expect } from 'vitest';
import { calculateTotalPrice, calculateGuestSupplierCost, buildGuestLineItems, activeGuestTypes, type GuestCounts } from '@/lib/utils/guest-pricing';

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
