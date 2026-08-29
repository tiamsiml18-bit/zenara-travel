import { describe, it, expect } from 'vitest';
import { computeFollowUpDueDates } from '@/lib/services/followups';
import { buildFollowUpMessage } from '@/lib/utils/followup-message';

describe('computeFollowUpDueDates — follow-up scheduling', () => {
  it('produces the default day 1/3/7/14 schedule from the spec', () => {
    const sentAt = new Date('2026-08-26T09:00:00Z');
    const dueDates = computeFollowUpDueDates(sentAt, [1, 3, 7, 14]);
    expect(dueDates).toEqual(['2026-08-27', '2026-08-29', '2026-09-02', '2026-09-09']);
  });

  it('respects a custom admin-configured schedule', () => {
    const sentAt = new Date('2026-01-01T00:00:00Z');
    const dueDates = computeFollowUpDueDates(sentAt, [2, 5]);
    expect(dueDates).toEqual(['2026-01-03', '2026-01-06']);
  });

  it('returns an empty array for an empty schedule', () => {
    expect(computeFollowUpDueDates(new Date('2026-01-01'), [])).toEqual([]);
  });

  it('correctly rolls over a month boundary', () => {
    const sentAt = new Date('2026-01-28T00:00:00Z');
    const dueDates = computeFollowUpDueDates(sentAt, [1, 3, 7]);
    expect(dueDates).toEqual(['2026-01-29', '2026-01-31', '2026-02-04']);
  });

  it('correctly rolls over a year boundary', () => {
    const sentAt = new Date('2026-12-28T00:00:00Z');
    const dueDates = computeFollowUpDueDates(sentAt, [1, 7]);
    expect(dueDates).toEqual(['2026-12-29', '2027-01-04']);
  });

  it('is stable for a timestamp near UTC midnight (regression guard for local-vs-UTC date math bugs)', () => {
    // A naive implementation mixing local-timezone getDate()/setDate() with
    // toISOString()'s UTC output can shift by a day depending on the host's
    // timezone. This uses a timestamp deliberately close to the UTC day
    // boundary — the correct answer never depends on server timezone.
    const sentAt = new Date('2026-08-26T23:30:00Z');
    const dueDates = computeFollowUpDueDates(sentAt, [1]);
    expect(dueDates).toEqual(['2026-08-27']);
  });
});

describe('buildFollowUpMessage', () => {
  it('includes the client name, destination, and quotation number', () => {
    const message = buildFollowUpMessage({
      clientFirstName: 'Maria',
      destination: 'Boracay',
      quotationNumber: 'QT-2026-00001',
    });
    expect(message).toContain('Maria');
    expect(message).toContain('Boracay');
    expect(message).toContain('QT-2026-00001');
  });

  it('signs off with the agency name when no agent name is given', () => {
    const message = buildFollowUpMessage({ clientFirstName: 'Ana', destination: 'Cebu', quotationNumber: 'QT-2026-00002' });
    expect(message).toContain('Zenara Travel and Tours');
  });

  it('signs off with the agent name when provided', () => {
    const message = buildFollowUpMessage({
      clientFirstName: 'Ana',
      destination: 'Cebu',
      quotationNumber: 'QT-2026-00002',
      agentFirstName: 'Leo',
    });
    expect(message).toContain('Leo');
  });
});
