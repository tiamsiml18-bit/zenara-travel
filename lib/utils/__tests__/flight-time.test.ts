import { describe, it, expect } from 'vitest';
import { formatTimeInput } from '@/lib/utils/flight-time';

describe('formatTimeInput — spec examples', () => {
  it('700PM -> 7:00 PM', () => {
    expect(formatTimeInput('700PM').formatted).toBe('7:00 PM');
  });
  it('830AM -> 8:30 AM', () => {
    expect(formatTimeInput('830AM').formatted).toBe('8:30 AM');
  });
  it('1245PM -> 12:45 PM', () => {
    expect(formatTimeInput('1245PM').formatted).toBe('12:45 PM');
  });
  it('900AM -> 9:00 AM', () => {
    expect(formatTimeInput('900AM').formatted).toBe('9:00 AM');
  });
});

describe('formatTimeInput — flexible re-entry of already-formatted values', () => {
  it('accepts a colon already present', () => {
    expect(formatTimeInput('7:00PM').formatted).toBe('7:00 PM');
    expect(formatTimeInput('7:00 PM').formatted).toBe('7:00 PM');
  });
  it('accepts lowercase am/pm', () => {
    expect(formatTimeInput('700pm').formatted).toBe('7:00 PM');
  });
  it('accepts hour-only entry (no minutes)', () => {
    expect(formatTimeInput('7PM').formatted).toBe('7:00 PM');
  });
  it('is case- and spacing-tolerant', () => {
    expect(formatTimeInput('  830 am ').formatted).toBe('8:30 AM');
  });
});

describe('formatTimeInput — validation, never guesses', () => {
  it('rejects an hour outside 1-12 for 12-hour input', () => {
    const result = formatTimeInput('1300PM');
    expect(result.formatted).toBeNull();
    expect(result.error).toContain('valid hour');
  });
  it('rejects minutes outside 00-59', () => {
    const result = formatTimeInput('875PM'); // only valid split is hour=8, minute=75
    expect(result.formatted).toBeNull();
    expect(result.error).toContain('minutes');
  });
  it('rejects nonsense input with a clear error, not a guess', () => {
    const result = formatTimeInput('sometime later');
    expect(result.formatted).toBeNull();
    expect(result.error).not.toBeNull();
  });
  it('treats an empty string as valid-but-empty (field is optional)', () => {
    const result = formatTimeInput('');
    expect(result.formatted).toBeNull();
    expect(result.error).toBeNull();
  });
});

describe('formatTimeInput — 24-hour/military time, every spec example', () => {
  it('1300 -> 1:00 PM', () => {
    expect(formatTimeInput('1300').formatted).toBe('1:00 PM');
  });
  it('0900 -> 9:00 AM', () => {
    expect(formatTimeInput('0900').formatted).toBe('9:00 AM');
  });
  it('1345 -> 1:45 PM', () => {
    expect(formatTimeInput('1345').formatted).toBe('1:45 PM');
  });
  it('2030 -> 8:30 PM', () => {
    expect(formatTimeInput('2030').formatted).toBe('8:30 PM');
  });
  it('0000 -> 12:00 AM', () => {
    expect(formatTimeInput('0000').formatted).toBe('12:00 AM');
  });
  it('2359 -> 11:59 PM', () => {
    expect(formatTimeInput('2359').formatted).toBe('11:59 PM');
  });
});

describe('formatTimeInput — 24-hour time with a colon, every spec example', () => {
  it('13:00 stays 24-hour and converts to 1:00 PM', () => {
    expect(formatTimeInput('13:00').formatted).toBe('1:00 PM');
  });
  it('20:30 -> 8:30 PM', () => {
    expect(formatTimeInput('20:30').formatted).toBe('8:30 PM');
  });
});

describe('formatTimeInput — colon input already containing AM/PM, every spec example', () => {
  it('7:00 AM stays 7:00 AM', () => {
    expect(formatTimeInput('7:00 AM').formatted).toBe('7:00 AM');
  });
  it('1:45 PM stays 1:45 PM', () => {
    expect(formatTimeInput('1:45 PM').formatted).toBe('1:45 PM');
  });
});

describe('formatTimeInput — 24-hour validation, every spec example', () => {
  it('1365 is invalid (minute out of range)', () => {
    const result = formatTimeInput('1365');
    expect(result.formatted).toBeNull();
    expect(result.error).not.toBeNull();
  });
  it('2560 is invalid (hour out of range)', () => {
    const result = formatTimeInput('2560');
    expect(result.formatted).toBeNull();
    expect(result.error).not.toBeNull();
  });
  it('2500 is invalid (hour out of range)', () => {
    const result = formatTimeInput('2500');
    expect(result.formatted).toBeNull();
    expect(result.error).not.toBeNull();
  });
});
