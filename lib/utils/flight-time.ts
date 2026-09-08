export interface TimeParseResult {
  formatted: string | null;
  error: string | null;
}

/**
 * Turns quick, colon-free entry (e.g. "700PM", "830AM", "1245PM") into
 * "h:mm AM/PM". Also accepts input that already has a colon or spacing
 * ("7:00 PM", "07:00PM") so re-editing an already-formatted value still
 * works. AM/PM is required — never guessed — and anything that doesn't
 * cleanly parse returns a clear error instead of silently picking a
 * value, per spec ("if the entered time is invalid or ambiguous, show a
 * clear validation message instead of guessing").
 */
export function formatTimeInput(raw: string): TimeParseResult {
  const trimmed = raw.trim();
  if (!trimmed) return { formatted: null, error: null }; // empty is fine — the field is optional

  const match = trimmed.match(/^(\d{1,2})(?::?(\d{2}))?\s*([AaPp])\.?[Mm]\.?$/);
  if (!match) {
    return { formatted: null, error: 'Enter a time with AM or PM, e.g. 700PM or 8:30 AM.' };
  }

  const hourStr = match[1];
  const minuteStr = match[2];
  const meridiemLetter = match[3];
  if (!hourStr || !meridiemLetter) {
    return { formatted: null, error: 'Enter a time with AM or PM, e.g. 700PM or 8:30 AM.' };
  }
  const hour = Number(hourStr);
  const minute = minuteStr ? Number(minuteStr) : 0;

  if (hour < 1 || hour > 12) {
    return { formatted: null, error: `${hour} isn't a valid hour (1-12) for a 12-hour time.` };
  }
  if (minute < 0 || minute > 59) {
    return { formatted: null, error: `${minuteStr} isn't a valid number of minutes (00-59).` };
  }

  const meridiem = meridiemLetter.toUpperCase() === 'A' ? 'AM' : 'PM';
  return { formatted: `${hour}:${String(minute).padStart(2, '0')} ${meridiem}`, error: null };
}
