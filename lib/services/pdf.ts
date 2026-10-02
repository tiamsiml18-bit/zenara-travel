import { renderToBuffer } from '@react-pdf/renderer';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getQuotationPdfData, getDetailedItineraryPdfData } from './pdf-data';
import { QuotationPdfDocument } from '@/pdf/quotation-pdf-document';
import { DetailedItineraryPdfDocument } from '@/pdf/detailed-itinerary-pdf-document';

/**
 * Renders a quotation's CURRENT version to a PDF buffer. Only ever reads
 * through getQuotationPdfData(), which cannot see internal pricing — see the
 * security note in that file. If it throws, the caller should show a
 * human-readable "couldn't generate PDF" message rather than a raw error.
 */
export async function renderQuotationPdf(supabase: SupabaseClient, quotationId: string): Promise<Buffer> {
  const data = await getQuotationPdfData(supabase, quotationId);
  return renderToBuffer(QuotationPdfDocument({ data }));
}

export function pdfFileName(quotationNumber: string, versionLabel: string): string {
  const safeVersion = versionLabel.toLowerCase().replace(/\s+/g, '-');
  return `${quotationNumber}-${safeVersion}.pdf`;
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
