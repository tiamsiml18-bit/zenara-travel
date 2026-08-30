import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { Pagination } from '@/components/ui/pagination';
import { createClient } from '@/lib/supabase/server';
import { listTours } from '@/lib/services/tours';
import { requireUser } from '@/lib/auth/session';
import { ToggleTourActiveButton } from '@/components/tours/toggle-tour-active-button';
import { DuplicateTourButton } from '@/components/tours/duplicate-tour-button';

function formatMoney(n: number | null) {
  if (n === null || n === undefined) return '—';
  return `PHP ${Number(n).toLocaleString('en-PH')}`;
}

export default async function ToursPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; all?: string; page?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const supabase = await createClient();

  const { tours, total, page, pageSize } = await listTours(supabase, {
    q: params.q,
    includeInactive: params.all === '1',
    page: params.page ? Number(params.page) : 1,
  });

  const canManage = user.role === 'admin' || user.role === 'manager';

  return (
    <>
      <Topbar title="Tours" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <form className="flex flex-1 gap-2" action="/tours">
            <input
              name="q"
              defaultValue={params.q}
              placeholder="Search by name or destination…"
              className="w-72 rounded-md border border-sand-200 px-3 py-2 text-sm outline-none ring-harbor-400 focus:ring-2"
            />
            <label className="flex items-center gap-1.5 text-sm text-ink-700">
              <input type="checkbox" name="all" value="1" defaultChecked={params.all === '1'} />
              Show archived
            </label>
            <button type="submit" className="rounded-md border border-sand-200 px-3 py-2 text-sm hover:bg-sand-100">
              Filter
            </button>
          </form>

          {canManage && (
            <Link
              href="/tours/new"
              className="flex items-center gap-1.5 rounded-md bg-harbor-700 px-4 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600"
            >
              <Plus className="h-4 w-4" /> New tour
            </Link>
          )}
        </div>

        <div className="overflow-hidden rounded-lg border border-sand-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-sand-200 bg-sand-50 text-left text-xs font-medium uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3">Tour</th>
                <th className="px-4 py-3">Destination</th>
                <th className="px-4 py-3">Adult rate</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {tours.map((t) => (
                <tr key={t.id} className="border-b border-sand-100 last:border-0 hover:bg-sand-50/50">
                  <td className="px-4 py-3">
                    <Link href={`/tours/${t.id}`} className="font-medium text-ink-900 hover:text-harbor-600">
                      {t.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-700">{t.destination ?? '—'}</td>
                  <td className="font-ticket px-4 py-3 text-ink-700">{formatMoney(t.price_adult)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        t.is_active
                          ? 'rounded-full bg-harbor-100 px-2 py-0.5 text-xs font-medium text-harbor-700'
                          : 'rounded-full bg-sand-100 px-2 py-0.5 text-xs font-medium text-ink-500'
                      }
                    >
                      {t.is_active ? 'Active' : 'Archived'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canManage && (
                      <div className="flex items-center justify-end gap-3">
                        <DuplicateTourButton tourId={t.id} />
                        <ToggleTourActiveButton tourId={t.id} isActive={t.is_active} />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {tours.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-ink-500">
                    No tours found. Add your first tour to start building it into the itinerary dropdown.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination total={total} page={page} pageSize={pageSize} basePath="/tours" searchParams={{ q: params.q, all: params.all }} />
      </main>
    </>
  );
}
