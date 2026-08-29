import { z } from 'zod';

/** Target fields a spreadsheet column can be mapped onto. */
export const IMPORT_FIELDS = [
  'fullName',
  'mobileNumber',
  'email',
  'destination',
  'travelStartDate',
  'travelEndDate',
  'quotedPrice',
  'statusName',
  'agentName',
  'sourceName',
  'notes',
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  fullName: 'Full name',
  mobileNumber: 'Mobile number',
  email: 'Email',
  destination: 'Destination',
  travelStartDate: 'Travel date',
  travelEndDate: 'Travel end date',
  quotedPrice: 'Quoted price',
  statusName: 'Status',
  agentName: 'Agent',
  sourceName: 'Source',
  notes: 'Notes',
};

export const IMPORT_REQUIRED_FIELDS: ImportField[] = ['fullName'];

/**
 * Synonyms used to auto-suggest a column mapping from spreadsheet header
 * text. Matching is case/whitespace-insensitive and tries an exact match
 * before falling back to "header contains synonym" — good enough for the
 * "Name / Full Name / Phone / Mobile / ..." variants named in the spec
 * without pulling in a fuzzy-matching dependency for something this small.
 */
const HEADER_SYNONYMS: Record<ImportField, string[]> = {
  fullName: ['full name', 'name', 'client name', 'customer name'],
  mobileNumber: ['mobile', 'phone', 'mobile number', 'phone number', 'contact number', 'contact'],
  email: ['email', 'email address', 'e-mail'],
  destination: ['destination', 'trip destination', 'travel destination'],
  travelStartDate: ['travel date', 'travel start date', 'start date', 'departure date', 'departure'],
  travelEndDate: ['travel end date', 'end date', 'return date'],
  quotedPrice: ['quoted price', 'price', 'quote', 'amount', 'quoted amount'],
  statusName: ['status', 'client status'],
  agentName: ['agent', 'assigned agent', 'consultant', 'travel consultant'],
  sourceName: ['source', 'lead source'],
  notes: ['notes', 'note', 'remarks', 'comments'],
};

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

/** Best-guess field for a given spreadsheet header, or null if nothing matches closely enough. */
export function suggestFieldForHeader(header: string): ImportField | null {
  const normalized = normalizeHeader(header);
  if (!normalized) return null;

  for (const field of IMPORT_FIELDS) {
    if (HEADER_SYNONYMS[field].includes(normalized)) return field;
  }
  for (const field of IMPORT_FIELDS) {
    if (HEADER_SYNONYMS[field].some((syn) => normalized.includes(syn) || syn.includes(normalized))) return field;
  }
  return null;
}

/** Auto-maps every header in a parsed sheet, leaving unmatched headers unmapped ('' / ignore). */
export function autoMapHeaders(headers: string[]): Record<string, ImportField | ''> {
  const mapping: Record<string, ImportField | ''> = {};
  const used = new Set<ImportField>();
  for (const header of headers) {
    const suggestion = suggestFieldForHeader(header);
    if (suggestion && !used.has(suggestion)) {
      mapping[header] = suggestion;
      used.add(suggestion);
    } else {
      mapping[header] = '';
    }
  }
  return mapping;
}

/** A single row after applying the admin's column mapping, values still raw strings from the sheet. */
export type MappedRow = Partial<Record<ImportField, string>> & { __rowNumber: number };

export interface NormalizedClientRow {
  rowNumber: number;
  fullName: string;
  mobileNumber: string | null;
  email: string | null;
  destination: string | null;
  travelStartDate: string | null;
  travelEndDate: string | null;
  quotedPrice: number | null;
  statusName: string | null;
  agentName: string | null;
  sourceName: string | null;
  notes: string | null;
}

export interface RowValidationResult {
  rowNumber: number;
  row: NormalizedClientRow | null;
  errors: string[];
  warnings: string[];
}

function parsePrice(raw: string): { value: number | null; error: string | null } {
  const cleaned = raw.replace(/[^\d.-]/g, '');
  if (cleaned === '') return { value: null, error: null };
  const num = Number(cleaned);
  if (Number.isNaN(num)) return { value: null, error: 'Quoted price is not a number.' };
  if (num < 0) return { value: null, error: 'Quoted price cannot be negative.' };
  return { value: num, error: null };
}

function parseDate(raw: string): { value: string | null; error: string | null } {
  const trimmed = raw.trim();
  if (!trimmed) return { value: null, error: null };
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return { value: null, error: `"${raw}" is not a recognizable date.` };
  return { value: date.toISOString().slice(0, 10), error: null };
}

const emailSchema = z.string().email();

/**
 * Validates one mapped row. Missing/unrecognized status, agent, or source
 * are WARNINGS (the row still imports, just without that association — an
 * admin can fix it afterward from the client list), matching the spirit of
 * "don't insert until confirmed" without blocking an otherwise-good row over
 * a lookup value that's merely spelled differently in the sheet.
 */
export function validateMappedRow(
  row: MappedRow,
  lookups: { statusNames: Set<string>; agentNames: Set<string>; sourceNames: Set<string> }
): RowValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const fullName = (row.fullName ?? '').trim();
  if (!fullName || fullName.length < 2) errors.push('Full name is required.');

  const emailRaw = (row.email ?? '').trim();
  let email: string | null = null;
  if (emailRaw) {
    const parsed = emailSchema.safeParse(emailRaw);
    if (!parsed.success) errors.push(`"${emailRaw}" is not a valid email.`);
    else email = emailRaw;
  }

  const mobileNumber = (row.mobileNumber ?? '').trim() || null;

  const { value: quotedPrice, error: priceError } = parsePrice(row.quotedPrice ?? '');
  if (priceError) errors.push(priceError);

  const { value: travelStartDate, error: startError } = parseDate(row.travelStartDate ?? '');
  if (startError) errors.push(startError);
  const { value: travelEndDate, error: endError } = parseDate(row.travelEndDate ?? '');
  if (endError) errors.push(endError);
  if (travelStartDate && travelEndDate && travelEndDate < travelStartDate) {
    errors.push('Travel end date is before the travel start date.');
  }

  const statusNameRaw = (row.statusName ?? '').trim();
  const statusMatch = [...lookups.statusNames].find((s) => s.toLowerCase() === statusNameRaw.toLowerCase());
  if (statusNameRaw && !statusMatch) warnings.push(`Status "${statusNameRaw}" not recognized — will be left unset.`);

  const agentNameRaw = (row.agentName ?? '').trim();
  const agentMatch = [...lookups.agentNames].find((a) => a.toLowerCase() === agentNameRaw.toLowerCase());
  if (agentNameRaw && !agentMatch) warnings.push(`Agent "${agentNameRaw}" not recognized — will be left unassigned.`);

  const sourceNameRaw = (row.sourceName ?? '').trim();
  const sourceMatch = [...lookups.sourceNames].find((s) => s.toLowerCase() === sourceNameRaw.toLowerCase());
  if (sourceNameRaw && !sourceMatch) warnings.push(`Source "${sourceNameRaw}" not recognized — will be left unset.`);

  if (errors.length > 0) {
    return { rowNumber: row.__rowNumber, row: null, errors, warnings };
  }

  return {
    rowNumber: row.__rowNumber,
    row: {
      rowNumber: row.__rowNumber,
      fullName,
      mobileNumber,
      email,
      destination: (row.destination ?? '').trim() || null,
      travelStartDate,
      travelEndDate,
      quotedPrice,
      statusName: statusMatch ?? null,
      agentName: agentMatch ?? null,
      sourceName: sourceMatch ?? null,
      notes: (row.notes ?? '').trim() || null,
    },
    errors: [],
    warnings,
  };
}
