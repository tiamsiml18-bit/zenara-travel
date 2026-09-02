import Link from 'next/link';
import { Topbar } from '@/components/layout/topbar';
import { StatusBadge } from '@/components/ui/status-badge';
import { Pagination } from '@/components/ui/pagination';
import { AutoSubmitSelect } from '@/components/ui/auto-submit-select';
import { AutoSubmitDateInput } from '@/components/ui/auto-submit-date-input';
import { createClient } from '@/lib/supabase/server';
import { listBookings } from '@/lib/services/bookings';
import { requireUser } from '@/lib/auth/session';

function formatDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}
function formatMoney(n?: number | null) {
  if (n === null || n === undefined) return '—';
  return `PHP ${Number(n).toLocaleString('en-PH')}`;
}

const PAYMENT_STATUS_STYLE: Record<string, string> = {
  unpaid: 'bg-coral-500/10 text-coral-600',
  partial: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  paid: 'bg-harbor-100 text-harbor-700',
  refunded: 'bg-sand-100 text-ink-500',
};

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

        <div className="overflow-hidden rounded-lg border border-sand-200 bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-sand-200 bg-sand-50 text-left text-xs font-medium uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3">Booking</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Destination</th>
                <th className="px-4 py-3">Travel dates</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="border-b border-sand-100 last:border-0 hover:bg-sand-50/50">
                  <td className="px-4 py-3">
                    <Link href={`/bookings/${b.id}`} className="font-ticket font-medium text-ink-900 hover:text-harbor-600">
                      {b.booking_number}
                    </Link>
                    <p className="text-xs text-ink-500">{b.quotation?.quotation_number}</p>
                  </td>
                  <td className="px-4 py-3 text-ink-700">{b.client?.full_name}</td>
                  <td className="px-4 py-3 text-ink-700">{b.destination}</td>
                  <td className="px-4 py-3 text-ink-700">
                    {formatDate(b.travel_start_date)} – {formatDate(b.travel_end_date)}
                  </td>
                  <td className="font-ticket px-4 py-3 text-ink-900">{formatMoney(b.total_amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${PAYMENT_STATUS_STYLE[b.payment_status] ?? ''}`}>
                      {b.payment_status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge label={b.status} />
                  </td>
                </tr>
              ))}
              {bookings.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-ink-500">
                    No bookings yet — confirmed quotations can be converted from the quotation page.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

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
