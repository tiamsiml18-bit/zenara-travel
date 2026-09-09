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
 *
 * Also accepts 24-hour/military time when no AM/PM is present — either
 * compact 4-digit ("1300", "0900", "2359", "0000") or with a colon
 * ("13:00", "20:30", "9:00"). Converted to the same "h:mm AM/PM" display
 * format as the 12-hour path. An hour of 24+ or a minute of 60+ is
 * always invalid, never silently reinterpreted.
 */
export function formatTimeInput(raw: string): TimeParseResult {
  const trimmed = raw.trim();
  if (!trimmed) return { formatted: null, error: null }; // empty is fine — the field is optional

  const match = trimmed.match(/^(\d{1,2})(?::?(\d{2}))?\s*([AaPp])\.?[Mm]\.?$/);
  if (match) {
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

  // No AM/PM present — try 24-hour/military time instead, either
  // "HH:MM" or compact 4-digit "HHMM".
  const militaryColon = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  const militaryCompact = trimmed.match(/^(\d{4})$/);
  if (militaryColon || militaryCompact) {
    const hourStr = militaryColon ? militaryColon[1]! : militaryCompact![1]!.slice(0, 2);
    const minuteStr = militaryColon ? militaryColon[2]! : militaryCompact![1]!.slice(2);
    const hour = Number(hourStr);
    const minute = Number(minuteStr);

    if (hour < 0 || hour > 23) {
      return { formatted: null, error: `${hour} isn't a valid hour (00-23) for 24-hour time.` };
    }
    if (minute < 0 || minute > 59) {
      return { formatted: null, error: `${minuteStr} isn't a valid number of minutes (00-59).` };
    }

    const meridiem = hour < 12 ? 'AM' : 'PM';
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return { formatted: `${hour12}:${String(minute).padStart(2, '0')} ${meridiem}`, error: null };
  }

  return { formatted: null, error: 'Enter a time like 700PM, 7:00 AM, or 24-hour time like 1900 or 19:00.' };
}
