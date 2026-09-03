/**
 * Generates suggested Inclusions and Exclusions purely from what's
 * actually been entered in the quotation so far — never a fixed sample
 * list. Used once, when the agent first reaches the Inclusions step with
 * an empty list, as a starting point they can freely add to, edit, or
 * remove from afterward (the existing TagListInput controls handle all
 * of that; this function only ever produces the initial suggestion).
 */

export interface InclusionsExclusionsInput {
  packageType: 'all_in' | 'land_arrangement' | null;
  hasAirfare: boolean;
  hasHotel: boolean;
  hotelName: string;
  hasTransfer: boolean;
  transferLabels: string[];
  tourNames: string[];
  otherCostLabels: string[];
}

export function generateSuggestedInclusions(input: InclusionsExclusionsInput): string[] {
  const items: string[] = [];

  if (input.packageType === 'all_in' && input.hasAirfare) {
    items.push('Roundtrip airfare');
  }
  if (input.hasHotel) {
    items.push(input.hotelName.trim() ? `Hotel accommodation at ${input.hotelName.trim()}` : 'Hotel accommodation');
  }
  if (input.hasTransfer) {
    // Named segments (e.g. "Hanoi Airport Transfer") list each one; an
    // unlabeled single Transfer section just gets the generic term.
    const labeled = input.transferLabels.filter((l) => l.trim());
    if (labeled.length > 0) {
      for (const label of labeled) items.push(label.trim());
    } else {
      items.push('Airport transfers');
    }
  }
  for (const name of input.tourNames) {
    if (name.trim()) items.push(name.trim());
  }
  for (const label of input.otherCostLabels) {
    if (label.trim()) items.push(label.trim());
  }

  return items;
}

export function generateSuggestedExclusions(input: InclusionsExclusionsInput): string[] {
  const items: string[] = [];

  // The clearest, most reliable signal for "airfare isn't included" is
  // Package Type itself (Land Arrangement Only), rather than guessing
  // from a possibly-still-empty rate field the agent just hasn't filled
  // in yet.
  if (input.packageType === 'land_arrangement') {
    items.push('Airfare');
  }

  // Standard travel-industry exclusions that apply to any package
  // regardless of what's included — not derived from a specific field,
  // but universally true rather than an invented or unrelated item.
  items.push('Personal expenses', 'Travel insurance', 'Items not mentioned in the inclusions');

  return items;
}
