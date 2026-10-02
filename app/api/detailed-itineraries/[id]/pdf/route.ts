import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import { renderDetailedItineraryPdf, detailedItineraryPdfFileName } from '@/lib/services/pdf';
import { getDetailedItineraryById, getInheritedQuotationData } from '@/lib/services/detailed-itineraries';

export const runtime = 'nodejs'; // react-pdf needs Node APIs, not the edge runtime

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isPreview = request.nextUrl.searchParams.get('preview') === '1';

  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const supabase = await createClient();

  try {
    const itinerary = await getDetailedItineraryById(supabase, id);
    const inherited = await getInheritedQuotationData(supabase, itinerary.booking_id as string);

    const pdfBuffer = await renderDetailedItineraryPdf(supabase, id);
    const fileName = detailedItineraryPdfFileName(inherited.booking.bookingNumber);

    const disposition = isPreview ? 'inline' : 'attachment';

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="${fileName}"`,
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
