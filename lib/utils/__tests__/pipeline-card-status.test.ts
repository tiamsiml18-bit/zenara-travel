import { describe, it, expect } from 'vitest';
import { computeCardStatus } from '@/lib/utils/pipeline-card-status';

const TODAY = '2026-08-31';

describe('computeCardStatus', () => {
  it('closed stages never get a badge, regardless of follow-up data', () => {
    for (const stage of ['confirmed', 'paid', 'lost', 'no_response'] as const) {
      expect(computeCardStatus(stage, { due_date: TODAY, status: 'pending', sequence_number: 1 }, 3, TODAY)).toBeNull();
    }
  });

  it('a follow-up due today is Needs Attention', () => {
    const status = computeCardStatus('negotiating', { due_date: TODAY, status: 'pending', sequence_number: 1 }, 3, TODAY);
    expect(status?.kind).toBe('needs_attention');
    expect(status?.progressLabel).toBe('Follow-up 1 of 3');
    expect(status?.detail).toBe('Due today');
  });

  it('an overdue follow-up is Needs Attention, with the correct day count', () => {
    const status = computeCardStatus('negotiating', { due_date: '2026-08-29', status: 'overdue', sequence_number: 1 }, 3, TODAY);
    expect(status?.kind).toBe('needs_attention');
    expect(status?.detail).toBe('Overdue by 2 days');
  });

  it('singular "day" when overdue by exactly 1', () => {
    const status = computeCardStatus('negotiating', { due_date: '2026-08-30', status: 'overdue', sequence_number: 1 }, 3, TODAY);
    expect(status?.detail).toBe('Overdue by 1 day');
  });

  it('due within 3 days is Upcoming (orange)', () => {
    const status = computeCardStatus('negotiating', { due_date: '2026-09-03', status: 'pending', sequence_number: 2 }, 3, TODAY);
    expect(status?.kind).toBe('upcoming');
    expect(status?.progressLabel).toBe('Follow-up 2 of 3');
    expect(status?.detail).toBe('Due Sep 3, 2026');
  });

  it('due more than 3 days out is Active (green)', () => {
    const status = computeCardStatus('negotiating', { due_date: '2026-09-05', status: 'pending', sequence_number: 2 }, 3, TODAY);
    expect(status?.kind).toBe('active');
    expect(status?.detail).toBe('Next: Sep 5, 2026');
  });

  it('no follow-up at all (and not closed) is Waiting for client', () => {
    const status = computeCardStatus('negotiating', null, 3, TODAY);
    expect(status?.kind).toBe('waiting');
    expect(status?.detail).toBe('Waiting for client');
  });

  it('schedule exhausted after the last follow-up was completed is Waiting, not a stale progress count', () => {
    const status = computeCardStatus('negotiating', { due_date: '2026-08-20', status: 'completed', sequence_number: 3 }, 3, TODAY);
    expect(status?.kind).toBe('waiting');
    expect(status?.progressLabel).toBe(''); // never shows "Follow-up 3 of 3" once the sequence has ended
  });

  it('a manually skipped/stopped follow-up with nothing newer generated is also Waiting', () => {
    const status = computeCardStatus('negotiating', { due_date: '2026-08-25', status: 'skipped', sequence_number: 2 }, 3, TODAY);
    expect(status?.kind).toBe('waiting');
  });
});
