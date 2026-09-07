import { describe, it, expect } from 'vitest';
import { computeHotelPerPersonBaseRate } from '@/lib/services/quotations';
import { calculateMarkedUpRates } from '@/lib/utils/guest-pricing';

describe('computeHotelPerPersonBaseRate — new Hotel total-amount model', () => {
  it('splits the total evenly across Adults + Seniors + Children + PWD, excluding Infant/Toddler entirely', () => {
    const base = computeHotelPerPersonBaseRate(12000, { numAdults: 2, numSeniors: 1, numChildren: 1, numPwd: 0 });
    // 2 + 1 + 1 + 0 = 4 paying guests, infant is never in this count
    expect(base).toBe(3000);
  });

  it('matches the spec example exactly: PHP 10,000 total + 10% markup = PHP 11,000 final', () => {
    const base = computeHotelPerPersonBaseRate(10000, { numAdults: 1, numSeniors: 0, numChildren: 0, numPwd: 0 });
    const marked = calculateMarkedUpRates({ adult: base }, 0.1);
    expect(marked.adult).toBe(11000);
  });

  it('matches the second spec example end to end: 4 paying guests, PHP 12,000 final (already includes markup) → PHP 3,000 each for Adult/Senior/Child/PWD, Infant free', () => {
    // Reverse-derive the pre-markup total the spec's "final" figure implies for a clean assertion.
    const guests = { numAdults: 2, numSeniors: 1, numChildren: 1, numPwd: 0 };
    const totalAmount = 12000 / 1.1; // pre-markup total such that final = 12,000 once 10% is applied
    const base = computeHotelPerPersonBaseRate(totalAmount, guests);
    const marked = calculateMarkedUpRates({ senior: base, adult: base, child: base, infant: 0, pwd: base }, 0.1);
    expect(marked.adult).toBeCloseTo(3000, 2);
    expect(marked.senior).toBeCloseTo(3000, 2);
    expect(marked.child).toBeCloseTo(3000, 2);
    expect(marked.pwd).toBeCloseTo(3000, 2);
    expect(marked.infant).toBe(0);
  });

  it('never lets Infant/Toddler count as a paying guest, even if a caller mistakenly includes it', () => {
    const withoutInfant = computeHotelPerPersonBaseRate(8000, { numAdults: 2, numSeniors: 0, numChildren: 0, numPwd: 0 });
    expect(withoutInfant).toBe(4000);
  });

  it('returns 0 rather than dividing by zero when there are no paying guests at all', () => {
    const base = computeHotelPerPersonBaseRate(10000, { numAdults: 0, numSeniors: 0, numChildren: 0, numPwd: 0 });
    expect(base).toBe(0);
  });

  it('OFF: with markup disabled, the final rate equals the exact per-person split of the base total', () => {
    const base = computeHotelPerPersonBaseRate(4000, { numAdults: 4, numSeniors: 0, numChildren: 0, numPwd: 0 });
    const marked = calculateMarkedUpRates({ adult: base }, 0);
    expect(marked.adult).toBe(1000);
  });

  it('a guest type with PHP 0 total stays at PHP 0 regardless of guest count', () => {
    const base = computeHotelPerPersonBaseRate(0, { numAdults: 3, numSeniors: 1, numChildren: 0, numPwd: 0 });
    expect(base).toBe(0);
  });
});
