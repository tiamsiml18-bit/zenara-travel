import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { StatusBadge } from '@/components/ui/status-badge';
import { Pagination } from '@/components/ui/pagination';
import { createClient } from '@/lib/supabase/server';
import { listClients } from '@/lib/services/clients';
import { listClientStatuses, listAgents } from '@/lib/services/lookups';
import { requireUser } from '@/lib/auth/session';

function formatDate(d?: string | null) {
  if (!d) return '\u2014';
  return new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}
function formatMoney(n?: number | null) {
  if (n === null || n === undefined) return '\u2014';
  return `PHP ${n.toLocaleString('en-PH', { minimumFractionDigits: 0 })}`;
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; agent?: string; page?: string }>;
}) {
  await requireUser();
  const params = await searchParams;
  const supabase = await createClient();

  const [{ clients, total, page, pageSize }, statuses, agents] = await Promise.all([
    listClients(supabase, {
      search: params.q,
      statusId: params.status,
      agentId: params.agent,
      page: params.page ? Number(params.page) : 1,
    }),
    listClientStatuses(supabase),
    listAgents(supabase),
  ]);

  return (
    <>
      <Topbar title="Clients" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <form className="flex flex-1 gap-2" action="/clients">
            <input
              name="q"
              defaultValue={params.q}
              placeholder="Search by name, phone, or email\u2026"
              className="w-72 rounded-md border border-sand-200 px-3 py-2 text-sm outline-none ring-harbor-400 focus:ring-2"
            />
            <select name="status" defaultValue={params.status} className="rounded-md border border-sand-200 px-3 py-2 text-sm">
              <option value="">All statuses</option>
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select name="agent" defaultValue={params.agent} className="rounded-md border border-sand-200 px-3 py-2 text-sm">
              <option value="">All agents</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name}
                </option>
              ))}
            </select>
            <button type="submit" className="rounded-md border border-sand-200 px-3 py-2 text-sm hover:bg-sand-100">
              Filter
            </button>
          </form>

          <Link
            href="/clients/new"
            className="ml-4 flex items-center gap-1.5 rounded-md bg-harbor-700 px-3 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600"
          >
            <Plus className="h-4 w-4" /> New client
          </Link>
        </div>

        <div className="overflow-hidden rounded-lg border border-sand-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-sand-200 bg-sand-50 text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Destination</th>
                <th className="px-4 py-3 font-medium">Travel date</th>
                <th className="px-4 py-3 font-medium">Quoted price</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Agent</th>
                <th className="px-4 py-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {clients.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-ink-500">
                    No clients match these filters yet.
                  </td>
                </tr>
              )}
              {clients.map((c: any) => (
                <tr key={c.id} className="hover:bg-sand-50">
                  <td className="px-4 py-3">
                    <Link href={`/clients/${c.id}`} className="font-medium text-ink-900 hover:text-harbor-600">
                      {c.full_name}
                    </Link>
                    <p className="text-xs text-ink-500">{c.email || c.mobile_number || '\u2014'}</p>
                  </td>
                  <td className="px-4 py-3 text-ink-700">{c.destination || '\u2014'}</td>
                  <td className="px-4 py-3 font-ticket text-ink-700">{formatDate(c.travel_start_date)}</td>
                  <td className="px-4 py-3 font-ticket text-ink-700">{formatMoney(c.quoted_price)}</td>
                  <td className="px-4 py-3">{c.status && <StatusBadge label={c.status.name} />}</td>
                  <td className="px-4 py-3 text-ink-700">{c.agent?.full_name ?? '\u2014'}</td>
                  <td className="px-4 py-3 text-ink-500">{formatDate(c.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            basePath="/clients"
            searchParams={{ q: params.q, status: params.status, agent: params.agent }}
          />
        </div>
      </main>
    </>
  );
}
