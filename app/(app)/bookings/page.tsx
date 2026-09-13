import { Topbar } from '@/components/layout/topbar';
import { Pagination } from '@/components/ui/pagination';
import { AutoSubmitSelect } from '@/components/ui/auto-submit-select';
import { AutoSubmitDateInput } from '@/components/ui/auto-submit-date-input';
import { BookingsTable } from '@/components/bookings/bookings-table';
import { createClient } from '@/lib/supabase/server';
import { listBookings } from '@/lib/services/bookings';
import { requireUser } from '@/lib/auth/session';

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; from?: string; to?: string; page?: string }>;
}) {
  await requireUser();
  const params = await searchParams;
  const supabase = await createClient();

  const { bookings, total, page, pageSize } = await listBookings(supabase, {
    status: params.status,
    travelStartFrom: params.from,
    travelStartTo: params.to,
    page: params.page ? Number(params.page) : 1,
  });

  const STATUS_OPTIONS = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];

  return (
    <>
      <Topbar title="Bookings" />
      <main className="flex-1 overflow-y-auto p-6">
        <form className="mb-4 flex flex-wrap gap-2" action="/bookings">
          <AutoSubmitSelect
            name="status"
            defaultValue={params.status}
            placeholder="All statuses"
            options={STATUS_OPTIONS.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))}
          />
          <AutoSubmitDateInput name="from" defaultValue={params.from} title="Travel date from" />
          <AutoSubmitDateInput name="to" defaultValue={params.to} title="Travel date to" />
        </form>

        <BookingsTable bookings={bookings} />

        <Pagination
          total={total}
          page={page}
          pageSize={pageSize}
          basePath="/bookings"
          searchParams={{ status: params.status, from: params.from, to: params.to }}
        />
      </main>
    </>
  );
}
