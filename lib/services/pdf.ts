import { renderToBuffer } from '@react-pdf/renderer';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getQuotationPdfData, getDetailedItineraryPdfData, type QuotationPdfData } from './pdf-data';
import { QuotationPdfDocument } from '@/pdf/quotation-pdf-document';
import { DetailedItineraryPdfDocument } from '@/pdf/detailed-itinerary-pdf-document';
import {
  availabilityFromData,
  emptySelectionMessage,
  hasPricingContent,
  isFullSections,
  type PdfSections,
} from '@/lib/utils/pdf-sections';

/** The selected sections have nothing to show on this quotation, so the PDF would be just a header. */
export class EmptyPdfSelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmptyPdfSelectionError';
  }
}

/**
 * Removes everything a document must not contain BEFORE it reaches the
 * renderer, so excluding pricing/fees/terms never depends on the PDF layout
 * code getting a conditional right. Only the generated document is affected —
 * this works on an in-memory copy and never touches the saved quotation.
 */
export function applyPdfSections(data: QuotationPdfData, sections: PdfSections): QuotationPdfData {
  if (isFullSections(sections)) return data;
  return {
    ...data,
    // Validity belongs to the price offer, so it only stays when pricing is really drawn.
    validUntil: hasPricingContent(sections, data.pricing.guestLines.length) ? data.validUntil : '',
    pricing: {
      ...data.pricing,
      guestLines: sections.perPersonRates ? data.pricing.guestLines : [],
      totalPrice: sections.pricingTotal ? data.pricing.totalPrice : 0,
    },
    // Fee amounts are prices: only ever present together with the pricing total.
    fees: sections.pricingTotal ? data.fees : [],
    itinerary: sections.itinerary ? data.itinerary : [],
    flightSegments: sections.flights ? data.flightSegments : [],
    inclusions: sections.inclusions ? data.inclusions : [],
    exclusions: sections.exclusions ? data.exclusions : [],
    agency: sections.terms
      ? data.agency
      : { ...data.agency, termsAndConditions: '', paymentInstructions: null },
  };
}

/**
 * Renders a quotation's CURRENT version to a PDF buffer. Only ever reads
 * through getQuotationPdfData(), which cannot see internal pricing — see the
 * security note in that file. If it throws, the caller should show a
 * human-readable "couldn't generate PDF" message rather than a raw error.
 *
 * `sections` selects which parts of the document to include. Left out (or all
 * on) it is the Full Quotation, rendered exactly as before — this is what the
 * emailed attachment and the default Preview/Download always get.
 */
export async function renderQuotationPdf(
  supabase: SupabaseClient,
  quotationId: string,
  sections?: PdfSections
): Promise<Buffer> {
  const data = await getQuotationPdfData(supabase, quotationId);
  if (!sections || isFullSections(sections)) return renderToBuffer(QuotationPdfDocument({ data }));
  // Never produce a bare header: refuse when no selected section has content.
  const emptyReason = emptySelectionMessage(sections, availabilityFromData(data));
  if (emptyReason) throw new EmptyPdfSelectionError(emptyReason);
  return renderToBuffer(QuotationPdfDocument({ data: applyPdfSections(data, sections), sections }));
}

export function pdfFileName(quotationNumber: string, versionLabel: string, suffix = ''): string {
  const safeVersion = versionLabel.toLowerCase().replace(/\s+/g, '-');
  return `${quotationNumber}-${safeVersion}${suffix}.pdf`;
}

/**
 * Renders a Detailed Itinerary to a PDF buffer. Entirely separate from
 * renderQuotationPdf() above — different data loader, different
 * presentational component, no shared render path.
 */
export async function renderDetailedItineraryPdf(supabase: SupabaseClient, detailedItineraryId: string): Promise<Buffer> {
  const data = await getDetailedItineraryPdfData(supabase, detailedItineraryId);
  return renderToBuffer(DetailedItineraryPdfDocument({ data }));
}

export function detailedItineraryPdfFileName(bookingNumber: string): string {
  return `${bookingNumber}-detailed-itinerary.pdf`;
}
