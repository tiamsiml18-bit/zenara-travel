import Link from 'next/link';
import { Suspense } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { QuotationFilterBar } from '@/components/quotations/quotation-filter-bar';
import { QuotationsTable } from '@/components/quotations/quotations-table';
import { Pagination } from '@/components/ui/pagination';
import { createClient } from '@/lib/supabase/server';
import { listQuotations } from '@/lib/services/quotations';
import { listConsultants } from '@/lib/services/lookups';
import { requireUser } from '@/lib/auth/session';

// Forces this page to be rendered fresh on every request rather than
// potentially reused from a cached render keyed only by pathname — status,
// consultant, and date filters all live in the query string, so a page
// cached without regard to searchParams could otherwise show stale,
// unfiltered results after selecting a filter.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

          <div className="flex items-center gap-2">
            <Link
              href="/quotations/deleted"
              className="flex items-center gap-1.5 rounded-md border border-sand-200 px-3 py-2 text-sm font-medium text-ink-700 hover:bg-sand-100"
            >
              <Trash2 className="h-4 w-4" /> Deleted Quotations
            </Link>
            <Link
              href="/quotations/new"
              className="flex items-center gap-1.5 rounded-md bg-harbor-700 px-3 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600"
            >
              <Plus className="h-4 w-4" /> New quotation
            </Link>
          </div>
        </div>

        <QuotationsTable quotations={quotations} />
        <div className="overflow-hidden rounded-b-lg border border-t-0 border-sand-200 bg-surface">
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
