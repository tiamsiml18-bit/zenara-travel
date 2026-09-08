import { describe, it, expect } from 'vitest';
import { buildAutoRoute, computeCarryForward } from '@/lib/utils/flight-details';

describe('buildAutoRoute', () => {
  it('matches the spec example: Manila -> Singapore becomes MNL - SIN', () => {
    expect(buildAutoRoute('Manila (MNL)', 'Singapore (SIN)')).toBe('MNL - SIN');
  });

  it('inserts the hyphen automatically -- the agent never types it', () => {
    const route = buildAutoRoute('Manila (MNL)', 'Singapore (SIN)');
    expect(route).toContain(' - ');
  });

  it('falls back to raw text when a side has no resolvable code, rather than dropping it', () => {
    expect(buildAutoRoute('Some Remote Airstrip', 'Singapore (SIN)')).toBe('Some Remote Airstrip - SIN');
  });

  it('returns null when both sides are empty, so callers know not to touch Route', () => {
    expect(buildAutoRoute('', '')).toBeNull();
  });

  it('returns just one side when only one is filled in', () => {
    expect(buildAutoRoute('Manila (MNL)', '')).toBe('MNL');
    expect(buildAutoRoute('', 'Singapore (SIN)')).toBe('SIN');
  });
});

describe('computeCarryForward (round-trip completion + multi-city carry)', () => {
  it("matches the spec's round-trip example: Flight 1 Manila->Singapore auto-fills Flight 2 as Singapore->Manila", () => {
    const segments = [
      { departure: 'Manila (MNL)', arrival: 'Singapore (SIN)' },
      { departure: '', arrival: '' },
    ];
    const patches = computeCarryForward(segments, 0);
    expect(patches.get(1)).toEqual({ departure: 'Singapore (SIN)', arrival: 'Manila (MNL)' });
  });

  it('never overwrites a field the agent has already filled in', () => {
    const segments = [
      { departure: 'Manila (MNL)', arrival: 'Singapore (SIN)' },
      { departure: 'Kuala Lumpur (KUL)', arrival: '' }, // agent already typed a custom departure
    ];
    const patches = computeCarryForward(segments, 0);
    // Departure must NOT be overwritten; arrival can still carry since it's empty.
    expect(patches.get(1)?.departure).toBeUndefined();
  });

  it('carries forward for multi-city (3+ segments): Flight 2 arrival flows into Flight 3 departure', () => {
    const segments = [
      { departure: 'Manila (MNL)', arrival: 'Singapore (SIN)' },
      { departure: 'Singapore (SIN)', arrival: 'Kuala Lumpur (KUL)' },
      { departure: '', arrival: '' },
    ];
    const patches = computeCarryForward(segments, 1);
    expect(patches.get(2)).toEqual({ departure: 'Kuala Lumpur (KUL)' });
  });

  it('does not apply the 2-segment round-trip completion rule when there are 3+ segments', () => {
    const segments = [
      { departure: 'Manila (MNL)', arrival: 'Singapore (SIN)' },
      { departure: 'Singapore (SIN)', arrival: 'Kuala Lumpur (KUL)' },
      { departure: 'Kuala Lumpur (KUL)', arrival: '' },
    ];
    const patches = computeCarryForward(segments, 0);
    // Only segment[1] could ever be touched from editing segment[0] here, and segment[1] is already fully filled.
    expect(patches.size).toBe(0);
  });

  it('produces no patches when the changed segment has nothing to carry', () => {
    const segments = [{ departure: '', arrival: '' }];
    expect(computeCarryForward(segments, 0).size).toBe(0);
  });

  it('supports a full round-trip multi-city loop: MNL - SIN - KUL - MNL', () => {
    // Flight 1: MNL -> SIN
    let segments = [
      { departure: 'Manila (MNL)', arrival: 'Singapore (SIN)' },
      { departure: '', arrival: '' },
      { departure: '', arrival: '' },
    ];
    let patches = computeCarryForward(segments, 0);
    expect(patches.get(1)).toEqual({ departure: 'Singapore (SIN)' });
    segments = segments.map((s, i) => (i === 1 ? { ...s, ...patches.get(1) } : s));

    // Flight 2: SIN -> KUL (agent fills in the arrival)
    segments[1]!.arrival = 'Kuala Lumpur (KUL)';
    patches = computeCarryForward(segments, 1);
    expect(patches.get(2)).toEqual({ departure: 'Kuala Lumpur (KUL)' });
  });
});
