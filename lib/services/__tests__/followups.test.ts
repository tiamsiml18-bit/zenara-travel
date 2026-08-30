import { describe, it, expect } from 'vitest';
import { addDaysUtc } from '@/lib/services/followups';
import { buildFollowUpMessage } from '@/lib/utils/followup-message';

describe('addDaysUtc — sequential follow-up date math', () => {
  it('adds the configured gap to the base date', () => {
    expect(addDaysUtc(new Date('2026-08-26T09:00:00Z'), 2)).toBe('2026-08-28');
  });

  it('matches the agency\'s example schedule when chained sequentially (2, then +3, then +5)', () => {
    // Follow-up 1: 2 days after send. Follow-up 2: 3 days after Follow-up
    // 1's completion. Follow-up 3: 5 days after Follow-up 2's completion.
    // Each call uses the PREVIOUS follow-up's actual completion time as the
    // base — simulated here by chaining, not by re-using the original sent
    // date for every step.
    const sentAt = new Date('2026-01-01T00:00:00Z');
    const followUp1Due = addDaysUtc(sentAt, 2);
    expect(followUp1Due).toBe('2026-01-03');

    const followUp1CompletedAt = new Date('2026-01-03T14:00:00Z'); // completed exactly on time
    const followUp2Due = addDaysUtc(followUp1CompletedAt, 3);
    expect(followUp2Due).toBe('2026-01-06');

    const followUp2CompletedAt = new Date('2026-01-08T10:00:00Z'); // completed 2 days LATE
    const followUp3Due = addDaysUtc(followUp2CompletedAt, 5);
    // Correctly based on the ACTUAL completion date, not a fixed offset
    // from the original send date — this is the whole point of sequential
    // generation over a batch-generated schedule.
    expect(followUp3Due).toBe('2026-01-13');
  });

  it('correctly rolls over a month boundary', () => {
    expect(addDaysUtc(new Date('2026-01-28T00:00:00Z'), 7)).toBe('2026-02-04');
  });

  it('correctly rolls over a year boundary', () => {
    expect(addDaysUtc(new Date('2026-12-28T00:00:00Z'), 7)).toBe('2027-01-04');
  });

  it('is stable for a timestamp near UTC midnight (regression guard for local-vs-UTC date math bugs)', () => {
    // A naive implementation mixing local-timezone getDate()/setDate() with
    // toISOString()'s UTC output can shift by a day depending on the host's
    // timezone. This uses a timestamp deliberately close to the UTC day
    // boundary — the correct answer never depends on server timezone.
    expect(addDaysUtc(new Date('2026-08-26T23:30:00Z'), 1)).toBe('2026-08-27');
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
