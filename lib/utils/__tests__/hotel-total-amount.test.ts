import { describe, it, expect } from 'vitest';
import { calculateHotelRatesFromTotal } from '@/lib/utils/guest-pricing';

describe('calculateHotelRatesFromTotal — the actual formula the quotation wizard uses live', () => {
  it('splits the total evenly across Adults + Seniors + Children + PWD, excluding Infant/Toddler entirely', () => {
    const rates = calculateHotelRatesFromTotal(12000, 0, false, { numAdults: 2, numSeniors: 1, numChildren: 1, numPwd: 0 });
    // 2 + 1 + 1 + 0 = 4 paying guests, infant is never in this count or in the return shape at all
    expect(rates.adult).toBe(3000);
    expect(rates.senior).toBe(3000);
    expect(rates.child).toBe(3000);
  });

  it('matches the spec example exactly: PHP 10,000 total + 10% markup = PHP 11,000 final', () => {
    const rates = calculateHotelRatesFromTotal(10000, 0.1, true, { numAdults: 1, numSeniors: 0, numChildren: 0, numPwd: 0 });
    expect(rates.adult).toBe(11000);
  });

  it("matches the user's second example end to end: PHP 14,000 total + 10% markup, 2 paying guests → PHP 7,700 each", () => {
    const rates = calculateHotelRatesFromTotal(14000, 0.1, true, { numAdults: 2, numSeniors: 0, numChildren: 0, numPwd: 0 });
    expect(rates.adult).toBe(7700);
  });

  it('only guest categories with quantity > 0 get the shared rate — everyone else is exactly 0, never the split value', () => {
    const rates = calculateHotelRatesFromTotal(15400, 0, false, { numAdults: 2, numSeniors: 0, numChildren: 0, numPwd: 0 });
    expect(rates.adult).toBe(7700);
    expect(rates.senior).toBe(0);
    expect(rates.child).toBe(0);
    expect(rates.pwd).toBe(0);
  });

  it('returns 0 for everyone rather than dividing by zero when there are no paying guests at all', () => {
    const rates = calculateHotelRatesFromTotal(10000, 0.1, true, { numAdults: 0, numSeniors: 0, numChildren: 0, numPwd: 0 });
    expect(rates.adult).toBe(0);
    expect(rates.senior).toBe(0);
    expect(rates.child).toBe(0);
    expect(rates.pwd).toBe(0);
  });

  it('markup OFF (disabled) uses the exact base total, ignoring whatever percentage is entered', () => {
    const rates = calculateHotelRatesFromTotal(4000, 0.5, false, { numAdults: 4, numSeniors: 0, numChildren: 0, numPwd: 0 });
    expect(rates.adult).toBe(1000);
  });

  it('a PHP 0 total produces PHP 0 for every paying guest type, regardless of guest count', () => {
    const rates = calculateHotelRatesFromTotal(0, 0.1, true, { numAdults: 3, numSeniors: 1, numChildren: 0, numPwd: 0 });
    expect(rates.adult).toBe(0);
    expect(rates.senior).toBe(0);
  });

  it('every paying category active at once still all shows the identical shared rate', () => {
    const rates = calculateHotelRatesFromTotal(20000, 0, false, { numAdults: 1, numSeniors: 1, numChildren: 1, numPwd: 1 });
    expect(rates.adult).toBe(5000);
    expect(rates.senior).toBe(5000);
    expect(rates.child).toBe(5000);
    expect(rates.pwd).toBe(5000);
  });

  it('rounds to the nearest whole peso, not cents — matches a real reported case: PHP 1,234 total + 10% markup ÷ 2 paying guests = PHP 678.70, which must display as PHP 679, not PHP 678.7', () => {
    const rates = calculateHotelRatesFromTotal(1234, 0.1, true, { numAdults: 2, numSeniors: 0, numChildren: 0, numPwd: 0 });
    expect(rates.adult).toBe(679);
    expect(Number.isInteger(rates.adult)).toBe(true);
  });
});
