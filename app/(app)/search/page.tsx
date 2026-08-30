import Link from 'next/link';
import { Topbar } from '@/components/layout/topbar';
import { StatusBadge } from '@/components/ui/status-badge';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireUser();
  const { q } = await searchParams;
  const query = (q ?? '').trim();
  const supabase = await createClient();

  let clients: Awaited<ReturnType<typeof searchClients>> = [];
  let quotations: Awaited<ReturnType<typeof searchQuotations>> = [];

  if (query) {
    [clients, quotations] = await Promise.all([searchClients(supabase, query), searchQuotations(supabase, query)]);
  }

  return (
    <>
      <Topbar title="Search" />
      <main className="flex-1 overflow-y-auto p-6">
        <form action="/search" className="mb-6 max-w-xl">
          <input
            name="q"
            defaultValue={query}
            autoFocus
            placeholder="Search clients, quotations, agents, destinations…"
            className="w-full rounded-md border border-sand-200 px-4 py-2.5 text-sm outline-none ring-harbor-400 focus:ring-2"
          />
        </form>

        {!query && <p className="text-sm text-ink-500">Search by client name, phone, email, quotation number, or destination.</p>}

        {query && clients.length === 0 && quotations.length === 0 && (
          <p className="text-sm text-ink-500">No matches for “{query}”.</p>
        )}

        {clients.length > 0 && (
          <section className="mb-8">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-500">Clients</h3>
            <div className="overflow-hidden rounded-lg border border-sand-200 bg-white">
              {clients.map((c) => (
                <Link
                  key={c.id}
                  href={`/clients/${c.id}`}
                  className="flex items-center justify-between border-b border-sand-100 px-4 py-3 text-sm last:border-0 hover:bg-sand-50"
                >
                  <div>
                    <p className="font-medium text-ink-900">{c.full_name}</p>
                    <p className="text-xs text-ink-500">
                      {[c.email, c.mobile_number, c.destination].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {quotations.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-500">Quotations</h3>
            <div className="overflow-hidden rounded-lg border border-sand-200 bg-white">
              {quotations.map((qt) => (
                <Link
                  key={qt.id}
                  href={`/quotations/${qt.id}`}
                  className="flex items-center justify-between border-b border-sand-100 px-4 py-3 text-sm last:border-0 hover:bg-sand-50"
                >
                  <div>
                    <p className="font-ticket font-medium text-ink-900">{qt.quotation_number}</p>
                    <p className="text-xs text-ink-500">
                      {qt.client?.full_name} · {qt.current_version?.destination ?? 'No destination set'}
                    </p>
                  </div>
                  <StatusBadge label={qt.status} />
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}

async function searchClients(supabase: Awaited<ReturnType<typeof createClient>>, query: string) {
  const { data, error } = await supabase
    .from('clients')
    .select('id, full_name, email, mobile_number, destination')
    .is('deleted_at', null)
    .or(`full_name.ilike.%${query}%,email.ilike.%${query}%,mobile_number.ilike.%${query}%,destination.ilike.%${query}%`)
    .limit(10);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function searchQuotations(supabase: Awaited<ReturnType<typeof createClient>>, query: string) {
  const baseSelect = `id, quotation_number, status,
       client:clients ( full_name ),
       current_version:quotation_versions!quotations_current_version_id_fkey ( destination )`;

  // Two separate queries, merged and deduped: PostgREST's .or() can't filter
  // across an embedded join in one call, and quotation_number vs. destination
  // live on different tables (quotations vs. quotation_versions). The second
  // query uses !inner on the embed specifically because a plain (non-inner)
  // embed filter only filters which NESTED rows come back, not which parent
  // quotations match — !inner is required to actually exclude quotations
  // whose destination doesn't match.
  const [byNumber, byDestination] = await Promise.all([
    supabase.from('quotations').select(baseSelect).is('deleted_at', null).ilike('quotation_number', `%${query}%`).limit(10),
    supabase
      .from('quotations')
      .select(
        `id, quotation_number, status,
         client:clients ( full_name ),
         current_version:quotation_versions!quotations_current_version_id_fkey!inner ( destination )`
      )
      .is('deleted_at', null)
      .ilike('current_version.destination', `%${query}%`)
      .limit(10),
  ]);
  if (byNumber.error) throw new Error(byNumber.error.message);
  if (byDestination.error) throw new Error(byDestination.error.message);

  const merged = new Map<string, (typeof byNumber.data)[number]>();
  for (const row of [...(byNumber.data ?? []), ...(byDestination.data ?? [])]) {
    merged.set(row.id, row);
  }

  return Array.from(merged.values())
    .slice(0, 10)
    .map((row) => ({
      ...row,
      client: Array.isArray(row.client) ? row.client[0] ?? null : row.client,
      current_version: Array.isArray(row.current_version) ? row.current_version[0] ?? null : row.current_version,
    }));
}
