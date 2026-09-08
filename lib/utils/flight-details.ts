import { extractCodeFromLabel } from './airport-label';

/**
 * Builds the auto-generated Route text from Departure/Arrival field
 * values, using each side's IATA code when one can be resolved and
 * falling back to the raw typed text otherwise (so a location the
 * airport dataset doesn't cover still produces something readable
 * rather than a blank route). Returns null when both sides are empty —
 * callers should leave Route untouched in that case, not clear it.
 */
export function buildAutoRoute(departure: string, arrival: string): string | null {
  const depPart = departure.trim() ? (extractCodeFromLabel(departure) ?? departure.trim()) : '';
  const arrPart = arrival.trim() ? (extractCodeFromLabel(arrival) ?? arrival.trim()) : '';
  if (!depPart && !arrPart) return null;
  if (!depPart) return arrPart;
  if (!arrPart) return depPart;
  return `${depPart} - ${arrPart}`;
}

export interface CarryableSegment {
  departure: string;
  arrival: string;
}

/**
 * Given the full list of segments and the index that was just edited,
 * returns a patch map (index -> partial update) for any OTHER segments
 * that should auto-carry a value forward — never touching a field that
 * already has something in it, since an agent's own entry always wins.
 * Two rules, both from the spec:
 *  1. Carry-forward: segment[i]'s arrival flows into segment[i+1]'s
 *     empty departure (supports multi-city/connecting itineraries).
 *  2. Round-trip completion: for exactly two segments, segment[0]'s
 *     departure flows into segment[1]'s empty arrival (completing the
 *     "back to origin" leg automatically).
 */
export function computeCarryForward(segments: CarryableSegment[], changedIndex: number): Map<number, Partial<CarryableSegment>> {
  const patches = new Map<number, Partial<CarryableSegment>>();

  const changed = segments[changedIndex];
  if (!changed) return patches;

  const next = segments[changedIndex + 1];
  if (next && !next.departure.trim() && changed.arrival.trim()) {
    patches.set(changedIndex + 1, { departure: changed.arrival });
  }

  if (segments.length === 2 && changedIndex === 0) {
    const last = segments[1];
    if (last && !last.arrival.trim() && changed.departure.trim()) {
      const existing = patches.get(1) ?? {};
      patches.set(1, { ...existing, arrival: changed.departure });
    }
  }

  return patches;
}
