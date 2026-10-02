import { Topbar } from '@/components/layout/topbar';
import { Pagination } from '@/components/ui/pagination';
import { AutoSubmitSelect } from '@/components/ui/auto-submit-select';
import { DetailedItinerariesTable } from '@/components/detailed-itineraries/detailed-itineraries-table';
import { createClient } from '@/lib/supabase/server';
import { listDetailedItineraries } from '@/lib/services/detailed-itineraries';
import { requireUser } from '@/lib/auth/session';
import { DETAILED_ITINERARY_STATUSES, type DetailedItineraryStatus } from '@/lib/validation/detailed-itinerary';

export default async function DetailedItinerariesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  await requireUser();
  const params = await searchParams;
  const supabase = await createClient();

  const status = DETAILED_ITINERARY_STATUSES.includes(params.status as DetailedItineraryStatus)
    ? (params.status as DetailedItineraryStatus)
    : undefined;

  const { itineraries, total, page, pageSize } = await listDetailedItineraries(supabase, {
    status,
    page: params.page ? Number(params.page) : 1,
  });

  return (
    <>
      <Topbar title="Detailed Itineraries" />
      <main className="flex-1 overflow-y-auto p-6">
        <p className="mb-4 max-w-2xl text-sm text-ink-500">
          Operational travel documents for confirmed, fully paid bookings — generated automatically 14 days before
          departure. A draft is never sent until an agent reviews, approves, and sends it.
        </p>

        <form className="mb-4 flex flex-wrap gap-2" action="/detailed-itineraries">
          <AutoSubmitSelect
            name="status"
            defaultValue={params.status}
            placeholder="All statuses"
            options={DETAILED_ITINERARY_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))}
          />
        </form>

        <DetailedItinerariesTable itineraries={itineraries} />

        <Pagination
          total={total}
          page={page}
          pageSize={pageSize}
          basePath="/detailed-itineraries"
          searchParams={{ status: params.status }}
        />
      </main>
    </>
  );
}
