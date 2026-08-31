import { describe, it, expect } from 'vitest';
import { computeDayDate } from '@/lib/utils/itinerary-dates';

describe('computeDayDate', () => {
  it('matches the spec example exactly — Sep 30 start, Days 1-6', () => {
    const start = '2026-09-30';
    expect(computeDayDate(start, 1)).toBe('2026-09-30');
    expect(computeDayDate(start, 2)).toBe('2026-10-01');
    expect(computeDayDate(start, 3)).toBe('2026-10-02');
    expect(computeDayDate(start, 4)).toBe('2026-10-03');
    expect(computeDayDate(start, 5)).toBe('2026-10-04');
    expect(computeDayDate(start, 6)).toBe('2026-10-05');
  });

  it('shifts the whole itinerary forward when the start date moves forward by one day', () => {
    const oldStart = '2026-09-30';
    const newStart = '2026-10-01';
    for (let day = 1; day <= 4; day++) {
      const oldDate = new Date(`${computeDayDate(oldStart, day)}T00:00:00Z`);
      const newDate = new Date(`${computeDayDate(newStart, day)}T00:00:00Z`);
      expect(newDate.getTime() - oldDate.getTime()).toBe(24 * 60 * 60 * 1000); // exactly one day later
    }
  });

  it('correctly rolls across a year boundary', () => {
    expect(computeDayDate('2026-12-30', 3)).toBe('2027-01-01');
  });
});
