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
  it('requires AM/PM — rejects 24-hour-style input with no meridiem', () => {
    const result = formatTimeInput('1900');
    expect(result.formatted).toBeNull();
    expect(result.error).not.toBeNull();
  });
  it('rejects an hour outside 1-12', () => {
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
