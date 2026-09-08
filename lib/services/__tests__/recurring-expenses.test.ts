import { describe, it, expect } from 'vitest';
import { periodKeyFor, nextPeriodStart, computeDueOccurrenceDates } from '@/lib/services/expenses';

describe('periodKeyFor', () => {
  it('produces the same monthly key for any two dates within the same month', () => {
    const a = periodKeyFor(new Date('2026-09-01T00:00:00Z'), 'monthly');
    const b = periodKeyFor(new Date('2026-09-28T00:00:00Z'), 'monthly');
    expect(a).toBe(b);
    expect(a).toBe('2026-09');
  });

  it('produces different monthly keys across a month boundary', () => {
    const aug = periodKeyFor(new Date('2026-08-31T00:00:00Z'), 'monthly');
    const sep = periodKeyFor(new Date('2026-09-01T00:00:00Z'), 'monthly');
    expect(aug).not.toBe(sep);
  });

  it('produces the same quarterly key for any date within the same quarter', () => {
    const a = periodKeyFor(new Date('2026-07-01T00:00:00Z'), 'quarterly');
    const b = periodKeyFor(new Date('2026-09-30T00:00:00Z'), 'quarterly');
    expect(a).toBe(b);
    expect(a).toBe('2026-Q3');
  });

  it('produces the same yearly key for any date within the same year', () => {
    const a = periodKeyFor(new Date('2026-01-01T00:00:00Z'), 'yearly');
    const b = periodKeyFor(new Date('2026-12-31T00:00:00Z'), 'yearly');
    expect(a).toBe(b);
    expect(a).toBe('2026');
  });
});

describe('nextPeriodStart', () => {
  it('steps monthly to the 1st of next month', () => {
    const next = nextPeriodStart(new Date('2026-09-15T00:00:00Z'), 'monthly');
    expect(next.toISOString().slice(0, 10)).toBe('2026-10-01');
  });

  it('steps quarterly by 3 months', () => {
    const next = nextPeriodStart(new Date('2026-09-15T00:00:00Z'), 'quarterly');
    expect(next.toISOString().slice(0, 10)).toBe('2026-12-01');
  });

  it('steps yearly by 12 months, correctly rolling the year', () => {
    const next = nextPeriodStart(new Date('2026-09-15T00:00:00Z'), 'yearly');
    expect(next.toISOString().slice(0, 10)).toBe('2027-09-01');
  });
});

describe('computeDueOccurrenceDates (the core duplicate-prevention input)', () => {
  it('matches the spec example: Canva PHP 1,000 monthly starting Sept 8, 2026, checked as of that same date — exactly one occurrence due', () => {
    const dates = computeDueOccurrenceDates({ startDate: '2026-09-08', endDate: null, frequency: 'monthly', asOf: new Date('2026-09-08T00:00:00Z') });
    expect(dates).toHaveLength(1);
    expect(dates[0]?.toISOString().slice(0, 10)).toBe('2026-09-08');
  });

  it('never generates occurrences beyond "asOf" — no future records created ahead of time', () => {
    const dates = computeDueOccurrenceDates({ startDate: '2026-01-01', endDate: null, frequency: 'monthly', asOf: new Date('2026-03-15T00:00:00Z') });
    expect(dates).toHaveLength(3);
    expect(dates.every((d) => d.getTime() <= new Date('2026-03-15T00:00:00Z').getTime())).toBe(true);
  });

  it('stops generating once past the end date, even if asOf is much later', () => {
    const dates = computeDueOccurrenceDates({ startDate: '2026-01-01', endDate: '2026-03-01', frequency: 'monthly', asOf: new Date('2026-12-31T00:00:00Z') });
    expect(dates).toHaveLength(3);
  });

  it('produces zero occurrences when the start date is in the future relative to asOf', () => {
    const dates = computeDueOccurrenceDates({ startDate: '2027-01-01', endDate: null, frequency: 'monthly', asOf: new Date('2026-09-08T00:00:00Z') });
    expect(dates).toHaveLength(0);
  });

  it('catches up correctly on multiple missed periods if generation has not run in a while', () => {
    const dates = computeDueOccurrenceDates({ startDate: '2026-05-01', endDate: null, frequency: 'monthly', asOf: new Date('2026-09-08T00:00:00Z') });
    expect(dates).toHaveLength(5);
  });

  it('quarterly and yearly frequencies produce far fewer occurrences than monthly over the same span', () => {
    const monthly = computeDueOccurrenceDates({ startDate: '2026-01-01', endDate: null, frequency: 'monthly', asOf: new Date('2026-12-31T00:00:00Z') });
    const quarterly = computeDueOccurrenceDates({ startDate: '2026-01-01', endDate: null, frequency: 'quarterly', asOf: new Date('2026-12-31T00:00:00Z') });
    const yearly = computeDueOccurrenceDates({ startDate: '2026-01-01', endDate: null, frequency: 'yearly', asOf: new Date('2026-12-31T00:00:00Z') });
    expect(monthly).toHaveLength(12);
    expect(quarterly).toHaveLength(4);
    expect(yearly).toHaveLength(1);
  });

  it('every produced date maps to a distinct period key — the actual guarantee against generating the same occurrence twice', () => {
    const dates = computeDueOccurrenceDates({ startDate: '2026-01-01', endDate: null, frequency: 'monthly', asOf: new Date('2026-06-15T00:00:00Z') });
    const keys = dates.map((d) => periodKeyFor(d, 'monthly'));
    expect(new Set(keys).size).toBe(keys.length);
  });
});
