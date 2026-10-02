import { Topbar } from '@/components/layout/topbar';
import { DetailedItineraryEditor } from '@/components/detailed-itineraries/detailed-itinerary-editor';
import { createClient } from '@/lib/supabase/server';
import { getDetailedItineraryDetail } from '@/lib/services/detailed-itineraries';
import { requireUser } from '@/lib/auth/session';

export default async function DetailedItineraryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const supabase = await createClient();

  const detail = await getDetailedItineraryDetail(supabase, id);

  return (
    <>
      <Topbar title={`Detailed Itinerary — ${detail.inherited.booking.bookingNumber}`} showBack />
      <main className="flex-1 overflow-y-auto p-6">
        <DetailedItineraryEditor detail={detail} />
      </main>
    </>
  );
}
