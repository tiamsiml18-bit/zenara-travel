import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import { renderQuotationPdf, pdfFileName } from '@/lib/services/pdf';
import { getQuotationById } from '@/lib/services/quotations';

export const runtime = 'nodejs'; // react-pdf needs Node APIs, not the edge runtime

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // requireUser() redirects browser navigations, but this is a fetch/download
  // endpoint — a redirect would corrupt the response, so we also handle the
  // unauthenticated case explicitly with a 401 below as a safety net.
  const { id } = await params;

  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const supabase = await createClient();

  try {
    // RLS already scopes this to quotations the caller may see; getQuotationById
    // additionally 404s cleanly if the row doesn't exist or isn't visible.
    const { quotation, currentVersion } = await getQuotationById(supabase, id);
    if (!currentVersion) {
      return NextResponse.json({ error: 'This quotation has no version to export.' }, { status: 404 });
    }

    const pdfBuffer = await renderQuotationPdf(supabase, id);
    const fileName = pdfFileName(quotation.quotation_number, currentVersion.version_label);

    // NextResponse's BodyInit typing doesn't accept a Node Buffer directly in
    // this TS/lib configuration (Buffer vs. the DOM Uint8Array shape) — an
    // explicit Uint8Array view over the same bytes satisfies it without a copy.
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate PDF.' },
      { status: 500 }
    );
  }
}
