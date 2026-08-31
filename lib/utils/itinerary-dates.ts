/**
 * Day N's date = Travel Start Date + (N-1) days. UTC arithmetic throughout
 * so this can't drift by a day depending on server timezone — the same
 * class of bug documented in lib/services/followups.ts's addDaysUtc.
 */
export function computeDayDate(startDate: string, dayNumber: number): string {
  const d = new Date(`${startDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + (dayNumber - 1));
  return d.toISOString().slice(0, 10);
}
