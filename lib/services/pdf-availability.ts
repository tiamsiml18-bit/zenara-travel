import type { SupabaseClient } from '@supabase/supabase-js';
import { getQuotationPdfData } from './pdf-data';
import { availabilityFromData, type PdfAvailability } from '@/lib/utils/pdf-sections';

/**
 * Which PDF sections have content on a quotation's CURRENT version (the one
 * the PDF route renders), so the document selector can explain why an option
 * would produce an empty document. Built from the same data loader the PDF
 * uses, so the page and the PDF cannot disagree. Returns null if it cannot be
 * worked out — the selector then allows everything and the PDF route's own
 * check still applies.
 */
export async function getPdfSectionAvailability(supabase: SupabaseClient, quotationId: string): Promise<PdfAvailability | null> {
  try {
    return availabilityFromData(await getQuotationPdfData(supabase, quotationId));
  } catch {
    return null;
  }
}
