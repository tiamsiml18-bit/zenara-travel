import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { ClientsTable } from '@/components/clients/clients-table';
import { Pagination } from '@/components/ui/pagination';
import { AutoSubmitSelect } from '@/components/ui/auto-submit-select';
import { createClient } from '@/lib/supabase/server';
import { listClients } from '@/lib/services/clients';
import { listClientStatuses, listAgents } from '@/lib/services/lookups';
import { requireUser } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; agent?: string; page?: string; view?: string }>;
}) {
  await requireUser();
  const params = await searchParams;
  const supabase = await createClient();
  const duplicatesOnly = params.view === 'duplicates';

  const [{ clients, total, page, pageSize }, statuses, agents] = await Promise.all([
    listClients(supabase, {
      search: params.q,
      statusId: params.status,
      agentId: params.agent,
      page: params.page ? Number(params.page) : 1,
      duplicatesOnly,
    }),
    listClientStatuses(supabase),
    listAgents(supabase),
  ]);

  return (
    <>
      <Topbar title="Clients" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex items-center gap-2 border-b border-sand-200">
          <Link
            href="/clients"
            className={`border-b-2 px-1 pb-2 text-sm font-medium ${
              !duplicatesOnly ? 'border-harbor-700 text-ink-900' : 'border-transparent text-ink-500 hover:text-ink-700'
            }`}
          >
            All Clients
          </Link>
          <Link
            href="/clients?view=duplicates"
            className={`border-b-2 px-1 pb-2 text-sm font-medium ${
              duplicatesOnly ? 'border-harbor-700 text-ink-900' : 'border-transparent text-ink-500 hover:text-ink-700'
            }`}
          >
            Duplicates
          </Link>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <form className="flex flex-1 gap-2" action="/clients">
            {duplicatesOnly && <input type="hidden" name="view" value="duplicates" />}
            <input
              name="q"
              defaultValue={params.q}
              placeholder="Search by name, phone, or email…"
              className="w-72 rounded-md border border-sand-200 px-3 py-2 text-sm outline-none ring-harbor-400 focus:ring-2"
            />
            <AutoSubmitSelect
              name="status"
              defaultValue={params.status}
              placeholder="All statuses"
              options={statuses.map((s) => ({ value: s.id, label: s.name }))}
            />
            <AutoSubmitSelect
              name="agent"
              defaultValue={params.agent}
              placeholder="All agents"
              options={agents.map((a) => ({ value: a.id, label: a.full_name }))}
            />
          </form>

          <Link
            href="/clients/new"
            className="ml-4 flex items-center gap-1.5 rounded-md bg-harbor-700 px-3 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600"
          >
            <Plus className="h-4 w-4" /> New client
          </Link>
        </div>

        <ClientsTable clients={clients} duplicatesView={duplicatesOnly} />
        <div className="overflow-hidden rounded-b-lg border border-t-0 border-sand-200 bg-surface">
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            basePath="/clients"
            searchParams={{ q: params.q, status: params.status, agent: params.agent, view: params.view }}
          />
        </div>
      </main>
    </>
  );
}
