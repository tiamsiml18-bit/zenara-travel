/**
 * Which sections of the client-facing quotation PDF to include.
 *
 * This is presentation-only: it decides what the generated PDF draws and
 * never touches the saved quotation. Shared by the quotation page (the
 * document output selector) and the PDF route/service, so both sides agree
 * on the same keys, presets and URL format.
 *
 * "Full Quotation" (all sections on) is also what you get when no option is
 * supplied at all — the route, the emailed attachment and the old
 * Preview/Download links all keep producing the existing PDF.
 */

export const PDF_SECTION_KEYS = [
  'itinerary',
  'flights',
  'inclusions',
  'exclusions',
  'pricingTotal',
  'perPersonRates',
  'terms',
] as const;

export type PdfSectionKey = (typeof PDF_SECTION_KEYS)[number];
export type PdfSections = Record<PdfSectionKey, boolean>;

export const PDF_SECTION_LABELS: Record<PdfSectionKey, string> = {
  itinerary: 'Itinerary',
  flights: 'Flight schedule',
  inclusions: 'Inclusions',
  exclusions: 'Exclusions',
  pricingTotal: 'Package pricing and total',
  perPersonRates: 'Per-person rates',
  terms: 'Terms and payment',
};

export const PDF_DOCUMENT_MODES = ['full', 'itinerary', 'no-itinerary', 'custom'] as const;
export type PdfDocumentMode = (typeof PDF_DOCUMENT_MODES)[number];

export const PDF_DOCUMENT_MODE_LABELS: Record<PdfDocumentMode, string> = {
  full: 'Full Quotation',
  itinerary: 'Itinerary Only',
  'no-itinerary': 'Quotation Without Itinerary',
  custom: 'Custom Selection',
};

export const FULL_SECTIONS: PdfSections = {
  itinerary: true,
  flights: true,
  inclusions: true,
  exclusions: true,
  pricingTotal: true,
  perPersonRates: true,
  terms: true,
};

const NO_SECTIONS: PdfSections = {
  itinerary: false,
  flights: false,
  inclusions: false,
  exclusions: false,
  pricingTotal: false,
  perPersonRates: false,
  terms: false,
};

/** Preset selections. Custom starts from Full and the user unticks what they do not want. */
export const PRESET_SECTIONS: Record<Exclude<PdfDocumentMode, 'custom'>, PdfSections> = {
  full: FULL_SECTIONS,
  itinerary: { ...NO_SECTIONS, itinerary: true, flights: true },
  'no-itinerary': { ...FULL_SECTIONS, itinerary: false },
};

export function hasAnySection(sections: PdfSections): boolean {
  return PDF_SECTION_KEYS.some((k) => sections[k]);
}

export function isFullSections(sections: PdfSections): boolean {
  return PDF_SECTION_KEYS.every((k) => sections[k]);
}

/**
 * True when the document will actually contain pricing: the total (always
 * drawn when selected) or per-person rows that really exist. Per-person Rates
 * selected on a quotation with no guest pricing rows draws nothing, so it does
 * not count — and the validity date, which belongs to the price offer, must
 * not appear on its own.
 */
export function hasPricingContent(sections: PdfSections, guestLineCount: number): boolean {
  return sections.pricingTotal || (sections.perPersonRates && guestLineCount > 0);
}

/** Which sections have anything to show for a given quotation. */
export type PdfAvailability = Record<PdfSectionKey, boolean>;

/**
 * Availability from the quotation's PDF data (or any object of the same
 * shape). The pricing total and terms are always drawn; the others need real
 * content — an empty Inclusions list would only be a heading over a dash.
 */
export function availabilityFromData(data: {
  itinerary: readonly unknown[];
  flightSegments: readonly unknown[];
  inclusions: readonly unknown[];
  exclusions: readonly unknown[];
  pricing: { guestLines: readonly unknown[] };
}): PdfAvailability {
  return {
    itinerary: data.itinerary.length > 0,
    flights: data.flightSegments.length > 0,
    inclusions: data.inclusions.length > 0,
    exclusions: data.exclusions.length > 0,
    pricingTotal: true,
    perPersonRates: data.pricing.guestLines.length > 0,
    terms: true,
  };
}

/** True when at least one selected section has content — i.e. the PDF would be more than a bare header. */
export function hasMeaningfulContent(sections: PdfSections, availability: PdfAvailability): boolean {
  return PDF_SECTION_KEYS.some((k) => sections[k] && availability[k]);
}

/** Why a selection cannot be generated, or null when it can. */
export function emptySelectionMessage(sections: PdfSections, availability: PdfAvailability): string | null {
  if (!hasAnySection(sections)) return 'Select at least one section.';
  if (hasMeaningfulContent(sections, availability)) return null;
  const names = PDF_SECTION_KEYS.filter((k) => sections[k]).map((k) => PDF_SECTION_LABELS[k].toLowerCase());
  return `This quotation has no ${names.join(' or ')} to show, so this document would be empty. Choose other sections.`;
}

/** Sections for a mode. For 'custom', unknown/absent keys default to off. */
export function sectionsForMode(mode: PdfDocumentMode, custom?: Partial<PdfSections>): PdfSections {
  if (mode !== 'custom') return { ...PRESET_SECTIONS[mode] };
  const result = { ...NO_SECTIONS };
  for (const k of PDF_SECTION_KEYS) result[k] = Boolean(custom?.[k]);
  return result;
}

export type ParsedPdfOptions =
  | { ok: true; mode: PdfDocumentMode; sections: PdfSections }
  | { ok: false; error: string };

/**
 * Reads ?doc=full|itinerary|no-itinerary|custom and, for custom,
 * &sections=itinerary,flights,... from the URL. No `doc` at all means the
 * Full Quotation — exactly the behavior before this feature existed.
 */
export function parsePdfOptions(params: URLSearchParams): ParsedPdfOptions {
  const doc = params.get('doc');
  if (doc === null || doc === '') return { ok: true, mode: 'full', sections: { ...FULL_SECTIONS } };
  if (!(PDF_DOCUMENT_MODES as readonly string[]).includes(doc)) {
    return { ok: false, error: `Unknown document option "${doc}".` };
  }
  const mode = doc as PdfDocumentMode;
  if (mode !== 'custom') return { ok: true, mode, sections: sectionsForMode(mode) };

  const raw = params.get('sections') ?? '';
  const keys = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const unknown = keys.filter((k) => !(PDF_SECTION_KEYS as readonly string[]).includes(k));
  if (unknown.length > 0) return { ok: false, error: `Unknown section "${unknown[0]}".` };
  const selected: Partial<PdfSections> = {};
  for (const k of keys as PdfSectionKey[]) selected[k] = true;
  const sections = sectionsForMode('custom', selected);
  if (!hasAnySection(sections)) return { ok: false, error: 'Select at least one section.' };
  return { ok: true, mode, sections };
}

/** The query string for a selection ("" for Full, so the existing URLs stay exactly as they were). */
export function serializePdfOptions(mode: PdfDocumentMode, sections: PdfSections): string {
  if (mode === 'full') return '';
  if (mode !== 'custom') return `doc=${mode}`;
  const keys = PDF_SECTION_KEYS.filter((k) => sections[k]);
  return `doc=custom&sections=${keys.join(',')}`;
}

/** Appended to the downloaded file name so different documents are easy to tell apart. Full keeps its original name. */
export function pdfFileSuffix(mode: PdfDocumentMode): string {
  if (mode === 'full') return '';
  if (mode === 'itinerary') return '-itinerary';
  if (mode === 'no-itinerary') return '-no-itinerary';
  return '-custom';
}
