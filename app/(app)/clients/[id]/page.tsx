import Link from 'next/link';
import { Plus, Pencil, Phone, Mail, MessageCircle } from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { StatusBadge } from '@/components/ui/status-badge';
import { ActivityTimeline } from '@/components/clients/activity-timeline';
import { ArchiveClientButton } from '@/components/clients/archive-client-button';
import { createClient } from '@/lib/supabase/server';
import { getClientById, getClientTimeline, getClientNotes } from '@/lib/services/clients';
import { listQuotationsByClient } from '@/lib/services/quotations';
import { addClientNoteAction } from '../actions';
import { requireUser } from '@/lib/auth/session';

function formatDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}
function formatMoney(n?: number | null) {
  if (n === null || n === undefined) return '—';
  return `PHP ${Number(n).toLocaleString('en-PH')}`;
}

export default async function ClientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const supabase = await createClient();

  const [client, timeline, notes, quotations] = await Promise.all([
    getClientById(supabase, id),
    getClientTimeline(supabase, id),
    getClientNotes(supabase, id),
    listQuotationsByClient(supabase, id),
  ]);

  return (
    <>
      <Topbar title={client.full_name} />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-3 gap-6">
          {/* Left column: client info */}
          <div className="col-span-1 space-y-6">
            <div className="rounded-lg border border-sand-200 bg-white p-5">
              <div className="mb-3 flex items-start justify-between">
                {client.status && <StatusBadge label={client.status.name} />}
                <div className="flex items-center gap-3">
                  <Link href={`/clients/${id}/edit`} className="text-ink-500 hover:text-harbor-600">
                    <Pencil className="h-4 w-4" />
                  </Link>
                  <ArchiveClientButton clientId={id} clientName={client.full_name} />
                </div>
              </div>

              <div className="space-y-2 text-sm">
                {client.mobile_number && (
                  <p className="flex items-center gap-2 text-ink-700">
                    <Phone className="h-3.5 w-3.5 text-ink-500" /> {client.mobile_number}
                  </p>
                )}
                {client.email && (
                  <p className="flex items-center gap-2 text-ink-700">
                    <Mail className="h-3.5 w-3.5 text-ink-500" /> {client.email}
                  </p>
                )}
                {client.messenger_handle && (
                  <p className="flex items-center gap-2 text-ink-700">
                    <MessageCircle className="h-3.5 w-3.5 text-ink-500" /> {client.messenger_handle} (Messenger)
                  </p>
                )}
              </div>

              <dl className="mt-4 space-y-2 border-t border-sand-100 pt-4 text-sm">
                <Row label="Source" value={client.source?.name ?? '—'} />
                <Row label="Destination" value={client.destination ?? '—'} />
                <Row
                  label="Travel dates"
                  value={
                    client.travel_start_date
                      ? `${formatDate(client.travel_start_date)} – ${formatDate(client.travel_end_date)}`
                      : '—'
                  }
                />
                <Row label="Guests" value={`${client.num_adults} adults, ${client.num_children} children`} />
                <Row label="Quoted price" value={formatMoney(client.quoted_price)} />
                <Row label="Assigned agent" value={client.agent?.full_name ?? '—'} />
                <Row label="Created" value={formatDate(client.created_at)} />
              </dl>

              {client.notes && (
                <p className="mt-4 border-t border-sand-100 pt-4 text-sm text-ink-700">{client.notes}</p>
              )}
            </div>

            <Link
              href={`/quotations/new?clientId=${id}`}
              className="flex items-center justify-center gap-1.5 rounded-md bg-harbor-700 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600"
            >
              <Plus className="h-4 w-4" /> Create quotation
            </Link>
          </div>

          {/* Middle column: quotations + notes */}
          <div className="col-span-1 space-y-6">
            <section className="rounded-lg border border-sand-200 bg-white p-5">
              <h2 className="mb-3 font-display text-sm font-semibold text-ink-900">Quotation history</h2>
              {quotations.length === 0 ? (
                <p className="text-sm text-ink-500">No quotations yet.</p>
              ) : (
                <ul className="divide-y divide-sand-100">
                  {quotations.map((q: any) => (
                    <li key={q.id} className="py-2.5">
                      <Link href={`/quotations/${q.id}`} className="flex items-center justify-between">
                        <div>
                          <p className="font-ticket text-sm font-medium text-ink-900">{q.quotation_number}</p>
                          <p className="text-xs text-ink-500">{q.current_version?.destination}</p>
                        </div>
                        <div className="text-right">
                          <StatusBadge label={q.status} />
                          <p className="mt-0.5 font-ticket text-xs text-ink-500">
                            {formatMoney(q.current_version?.total_price)}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-lg border border-sand-200 bg-white p-5">
              <h2 className="mb-3 font-display text-sm font-semibold text-ink-900">Notes</h2>
              <form action={addClientNoteAction} className="mb-4 flex gap-2">
                <input type="hidden" name="clientId" value={id} />
                <input
                  name="note"
                  placeholder="Add a note…"
                  className="flex-1 rounded-md border border-sand-200 px-3 py-1.5 text-sm outline-none ring-harbor-400 focus:ring-2"
                />
                <button type="submit" className="rounded-md border border-sand-200 px-3 py-1.5 text-sm hover:bg-sand-100">
                  Add
                </button>
              </form>
              <ul className="space-y-3">
                {notes.map((n: any) => (
                  <li key={n.id} className="text-sm">
                    <p className="text-ink-900">{n.note}</p>
                    <p className="text-xs text-ink-500">
                      {n.author?.full_name} &middot; {formatDate(n.created_at)}
                    </p>
                  </li>
                ))}
                {notes.length === 0 && <p className="text-sm text-ink-500">No notes yet.</p>}
              </ul>
            </section>
          </div>

          {/* Right column: timeline */}
          <div className="col-span-1">
            <section className="rounded-lg border border-sand-200 bg-white p-5">
              <h2 className="mb-4 font-display text-sm font-semibold text-ink-900">Activity timeline</h2>
              <ActivityTimeline activities={timeline as any} />
            </section>
          </div>
        </div>
      </main>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-500">{label}</dt>
      <dd className="text-right text-ink-900">{value}</dd>
    </div>
  );
}
