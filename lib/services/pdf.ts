import { renderToBuffer } from '@react-pdf/renderer';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getQuotationPdfData } from './pdf-data';
import { QuotationPdfDocument } from '@/pdf/quotation-pdf-document';

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
