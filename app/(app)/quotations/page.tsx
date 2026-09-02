import Link from 'next/link';
import { Suspense } from 'react';
import { Plus } from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { StatusBadge } from '@/components/ui/status-badge';
import { Pagination } from '@/components/ui/pagination';
import { QuotationFilterBar } from '@/components/quotations/quotation-filter-bar';
import { createClient } from '@/lib/supabase/server';
import { listQuotations } from '@/lib/services/quotations';
import { listConsultants } from '@/lib/services/lookups';
import { PIPELINE_STAGE_LABELS, type PipelineStage } from '@/lib/services/pipeline';
import { requireUser } from '@/lib/auth/session';

// Forces this page to be rendered fresh on every request rather than
// potentially reused from a cached render keyed only by pathname — status,
// consultant, and date filters all live in the query string, so a page
// cached without regard to searchParams could otherwise show stale,
// unfiltered results after selecting a filter.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

  const consultants = await listConsultants(supabase);
  const { quotations, total, page, pageSize } = await listQuotations(supabase, {
    status: params.status || undefined,
    consultantId: params.consultant || undefined,
    travelStartFrom: params.from || undefined,
    travelStartTo: params.to || undefined,
    page: params.page ? Number(params.page) : 1,
  });

  return (
    <>
      <Topbar title="Quotations" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Suspense fallback={<div className="h-[42px]" />}>
            <QuotationFilterBar consultants={consultants} />
          </Suspense>

          <Link
            href="/quotations/new"
            className="flex items-center gap-1.5 rounded-md bg-harbor-700 px-3 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600"
          >
            <Plus className="h-4 w-4" /> New quotation
          </Link>
        </div>

        <div className="overflow-hidden rounded-lg border border-sand-200 bg-surface">
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
                    <StatusBadge label={q.status ? PIPELINE_STAGE_LABELS[q.status as PipelineStage] : 'Draft'} />
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
