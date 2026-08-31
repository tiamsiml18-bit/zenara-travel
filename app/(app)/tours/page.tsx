import Link from 'next/link';
import { Plus, X } from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { Pagination } from '@/components/ui/pagination';
import { AutoSubmitSelect } from '@/components/ui/auto-submit-select';
import { AutoSubmitCheckbox } from '@/components/ui/auto-submit-checkbox';
import { createClient } from '@/lib/supabase/server';
import { listTours, listTourDestinations } from '@/lib/services/tours';
import { requireUser } from '@/lib/auth/session';
import { ToggleTourActiveButton } from '@/components/tours/toggle-tour-active-button';
import { DuplicateTourButton } from '@/components/tours/duplicate-tour-button';

function formatMoney(n: number | null) {
  if (n === null || n === undefined) return '—';
  return `PHP ${Number(n).toLocaleString('en-PH')}`;
}

const TOUR_TYPE_OPTIONS = [
  { value: 'all_in', label: 'All-In' },
  { value: 'land_arrangement', label: 'Land Arrangement' },
];

// Each bucket's [min, max] based on the Tour's default Adult rate — display
// categorization only, per spec; the tour's actual stored rate is never
// touched. .01 boundaries keep each bucket's edges non-overlapping without
// needing a separate "strictly less than" query operator.
const PRICE_RANGES: Record<string, { min?: number; max?: number; label: string }> = {
  under_1000: { max: 999.99, label: 'Under PHP 1,000' },
  '1000_3000': { min: 1000, max: 3000, label: 'PHP 1,000 to PHP 3,000' },
  '3001_5000': { min: 3001, max: 5000, label: 'PHP 3,001 to PHP 5,000' },
  '5001_10000': { min: 5001, max: 10000, label: 'PHP 5,001 to PHP 10,000' },
  above_10000: { min: 10000.01, label: 'Above PHP 10,000' },
};

export default async function ToursPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; destination?: string; type?: string; price?: string; all?: string; page?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const supabase = await createClient();

  const priceRange = params.price ? PRICE_RANGES[params.price] : undefined;
  const hasActiveFilters = Boolean(params.q || params.destination || params.type || params.price);

  const [{ tours, total, page, pageSize }, destinations] = await Promise.all([
    listTours(supabase, {
      q: params.q,
      destination: params.destination,
      tourType: params.type as 'all_in' | 'land_arrangement' | undefined,
      priceMin: priceRange?.min,
      priceMax: priceRange?.max,
      includeInactive: params.all === '1',
      page: params.page ? Number(params.page) : 1,
    }),
    listTourDestinations(supabase),
  ]);

  const canManage = user.role === 'admin' || user.role === 'manager';

  // Grouped by destination whenever no single destination is already
  // selected — makes the list scannable without needing the filter for the
  // common case of "show me everything, organized."
  const groups = new Map<string, typeof tours>();
  for (const t of tours) {
    const key = t.destination ?? 'No destination set';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  return (
    <>
      <Topbar title="Tours" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <form className="flex flex-1 flex-wrap gap-2" action="/tours">
            <input
              name="q"
              defaultValue={params.q}
              placeholder="Search tours…"
              className="w-56 rounded-md border border-sand-200 px-3 py-2 text-sm outline-none ring-harbor-400 focus:ring-2"
            />
            <AutoSubmitSelect
              name="type"
              defaultValue={params.type}
              placeholder="All tour types"
              options={TOUR_TYPE_OPTIONS}
              className="rounded-md border border-sand-200 px-3 py-2 text-sm outline-none ring-harbor-400 focus:ring-2"
            />
            <AutoSubmitSelect
              name="destination"
              defaultValue={params.destination}
              placeholder="All destinations"
              options={destinations.map((d) => ({ value: d, label: d }))}
              className="rounded-md border border-sand-200 px-3 py-2 text-sm outline-none ring-harbor-400 focus:ring-2"
            />
            <AutoSubmitSelect
              name="price"
              defaultValue={params.price}
              placeholder="All prices"
              options={Object.entries(PRICE_RANGES).map(([value, r]) => ({ value, label: r.label }))}
              className="rounded-md border border-sand-200 px-3 py-2 text-sm outline-none ring-harbor-400 focus:ring-2"
            />
            <AutoSubmitCheckbox name="all" defaultChecked={params.all === '1'} label="Show archived" />
            {hasActiveFilters && (
              <Link
                href="/tours"
                className="flex items-center gap-1 rounded-md px-2.5 py-2 text-sm font-medium text-ink-500 hover:bg-sand-100 hover:text-ink-900"
              >
                <X className="h-3.5 w-3.5" /> Clear filters
              </Link>
            )}
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

        <div className="space-y-6">
          {Array.from(groups.entries()).map(([destination, groupTours]) => (
            <div key={destination} className="overflow-hidden rounded-lg border border-sand-200 bg-white">
              <div className="border-b border-sand-200 bg-sand-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-700">
                {destination}
              </div>
              <table className="w-full text-sm">
                <thead className="border-b border-sand-200 text-left text-xs font-medium uppercase tracking-wide text-ink-500">
                  <tr>
                    <th className="px-4 py-2.5">Tour</th>
                    <th className="px-4 py-2.5">Type</th>
                    <th className="px-4 py-2.5">Adult rate</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {groupTours.map((t) => (
                    <tr key={t.id} className="border-b border-sand-100 last:border-0 hover:bg-sand-50/50">
                      <td className="px-4 py-3">
                        <Link href={`/tours/${t.id}`} className="font-medium text-ink-900 hover:text-harbor-600">
                          {t.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-xs text-ink-500">
                        {t.tour_type ? TOUR_TYPE_OPTIONS.find((o) => o.value === t.tour_type)?.label ?? t.tour_type : '—'}
                      </td>
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
                </tbody>
              </table>
            </div>
          ))}
          {tours.length === 0 && (
            <div className="rounded-lg border border-sand-200 bg-white px-4 py-10 text-center text-ink-500">
              No tours found. Add your first tour to start building it into the itinerary dropdown.
            </div>
          )}
        </div>

        <Pagination
          total={total}
          page={page}
          pageSize={pageSize}
          basePath="/tours"
          searchParams={{ q: params.q, destination: params.destination, type: params.type, price: params.price, all: params.all }}
        />
      </main>
    </>
  );
}
