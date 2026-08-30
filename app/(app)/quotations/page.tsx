import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { StatusBadge } from '@/components/ui/status-badge';
import { Pagination } from '@/components/ui/pagination';
import { createClient } from '@/lib/supabase/server';
import { listQuotations } from '@/lib/services/quotations';
import { listConsultants } from '@/lib/services/lookups';
import { requireUser } from '@/lib/auth/session';

function formatDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}
function formatMoney(n?: number | null) {
  if (n === null || n === undefined) return '—';
  return `PHP ${Number(n).toLocaleString('en-PH')}`;
}

export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; consultant?: string; from?: string; to?: string; page?: string }>;
}) {
  await requireUser();
  const params = await searchParams;
  const supabase = await createClient();

  const [{ quotations, total, page, pageSize }, consultants] = await Promise.all([
    listQuotations(supabase, {
      status: params.status,
      consultantId: params.consultant,
      travelStartFrom: params.from,
      travelStartTo: params.to,
      page: params.page ? Number(params.page) : 1,
    }),
    listConsultants(supabase),
  ]);

  const STATUS_OPTIONS = [
    'draft', 'sent', 'viewed', 'follow_up', 'negotiating', 'confirmed', 'paid', 'cancelled', 'lost', 'expired',
  ];

  return (
    <>
      <Topbar title="Quotations" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <form className="flex flex-wrap gap-2" action="/quotations">
            <select name="status" defaultValue={params.status} className="rounded-md border border-sand-200 px-3 py-2 text-sm">
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            {/* Filters by consultant, not the technical assigned-agent
                account — with one shared login across the team, filtering by
                assigned agent would never narrow anything down, since every
                quotation has the same value there. Consultant is the field
                that actually distinguishes who worked on it. */}
            <select name="consultant" defaultValue={params.consultant} className="rounded-md border border-sand-200 px-3 py-2 text-sm">
              <option value="">All consultants</option>
              {consultants.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
            <input
              type="date"
              name="from"
              defaultValue={params.from}
              title="Travel date from"
              className="rounded-md border border-sand-200 px-3 py-2 text-sm"
            />
            <input
              type="date"
              name="to"
              defaultValue={params.to}
              title="Travel date to"
              className="rounded-md border border-sand-200 px-3 py-2 text-sm"
            />
            <button type="submit" className="rounded-md border border-sand-200 px-3 py-2 text-sm hover:bg-sand-100">
              Filter
            </button>
          </form>

          <Link
            href="/quotations/new"
            className="flex items-center gap-1.5 rounded-md bg-harbor-700 px-3 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600"
          >
            <Plus className="h-4 w-4" /> New quotation
          </Link>
        </div>

        <div className="overflow-hidden rounded-lg border border-sand-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-sand-200 bg-sand-50 text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3 font-medium">Quotation No.</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Destination</th>
                <th className="px-4 py-3 font-medium">Travel dates</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Consultant</th>
                <th className="px-4 py-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {quotations.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-ink-500">
                    No quotations match these filters yet.
                  </td>
                </tr>
              )}
              {quotations.map((q: any) => (
                <tr key={q.id} className="hover:bg-sand-50">
                  <td className="px-4 py-3">
                    <Link href={`/quotations/${q.id}`} className="font-ticket font-medium text-ink-900 hover:text-harbor-600">
                      {q.quotation_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-700">{q.client?.full_name}</td>
                  <td className="px-4 py-3 text-ink-700">{q.current_version?.destination ?? '—'}</td>
                  <td className="px-4 py-3 font-ticket text-ink-700">
                    {formatDate(q.current_version?.travel_start_date)}
                  </td>
                  <td className="px-4 py-3 font-ticket text-ink-700">{formatMoney(q.current_version?.total_price)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge label={q.status} />
                  </td>
                  <td className="px-4 py-3 text-ink-700">{q.current_version?.consultant_name_snapshot ?? '—'}</td>
                  <td className="px-4 py-3 text-ink-500">{formatDate(q.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            basePath="/quotations"
            searchParams={{ status: params.status, consultant: params.consultant, from: params.from, to: params.to }}
          />
        </div>
      </main>
    </>
  );
}
