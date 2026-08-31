import Link from 'next/link';
import { Download, Pencil } from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { StatusBadge } from '@/components/ui/status-badge';
import { SendQuotationButton, DuplicateQuotationButton } from '@/components/quotations/quotation-actions';
import { QuotationStatusControls, ConvertToBookingButton } from '@/components/quotations/quotation-status-controls';
import { ArchiveQuotationButton } from '@/components/quotations/archive-quotation-button';
import { PdfPreviewButton } from '@/components/quotations/pdf-preview-button';
import { SendQuotationEmailButton } from '@/components/quotations/send-quotation-email-button';
import { createClient } from '@/lib/supabase/server';
import { getQuotationById, getVersionDetail, getPricingForVersion } from '@/lib/services/quotations';
import { getBookingForQuotation } from '@/lib/services/bookings';
import { getGmailConnection } from '@/lib/services/gmail';
import { getEmailHistory } from '@/lib/services/email';
import { generateQuotationEmail } from '@/lib/utils/email-templates';
import { requireUser } from '@/lib/auth/session';

function formatDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}
function formatMoney(n?: number | null) {
  if (n === null || n === undefined) return '—';
  return `PHP ${Number(n).toLocaleString('en-PH')}`;
}

export default async function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const supabase = await createClient();

  const { quotation, versions, currentVersion } = await getQuotationById(supabase, id);
  if (!currentVersion) throw new Error('This quotation has no version data.');

  const [{ itinerary, inclusions, exclusions }, pricing, existingBooking, gmailConnection, emailHistory] = await Promise.all([
    getVersionDetail(supabase, currentVersion.id),
    getPricingForVersion(supabase, currentVersion.id),
    getBookingForQuotation(supabase, id),
    getGmailConnection(supabase),
    getEmailHistory(supabase, id),
  ]);

  const isDraft = currentVersion.status === 'draft';

  const consultantFirstName = (currentVersion.consultant_name_snapshot ?? quotation.agent?.full_name ?? 'Your consultant').split(' ')[0]!;
  const clientFirstName = (quotation.client?.full_name ?? 'there').split(' ')[0]!;
  const quotationEmailDraft = generateQuotationEmail({
    clientFirstName,
    destination: currentVersion.destination,
    consultantFirstName,
    isRevision: currentVersion.version_number > 1,
  });

  return (
    <>
      <Topbar title={quotation.quotation_number} showBack />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-ticket text-lg font-semibold text-ink-900">{quotation.quotation_number}</h2>
              <span className="font-ticket text-sm text-ink-500">{currentVersion.version_label}</span>
              <StatusBadge label={quotation.status} />
            </div>
            <p className="mt-1 text-sm text-ink-500">
              {quotation.client?.full_name} &middot; {currentVersion.destination} &middot; agent:{' '}
              {quotation.agent?.full_name ?? '—'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/clients/${quotation.client_id}`}
              className="rounded-md border border-sand-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-sand-100"
            >
              View client
            </Link>
            <PdfPreviewButton quotationId={id} />
            <a
              href={`/api/quotations/${id}/pdf`}
              className="flex items-center gap-1.5 rounded-md border border-sand-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-sand-100"
            >
              <Download className="h-4 w-4" /> Download PDF
            </a>
            <SendQuotationEmailButton
              quotationId={id}
              connectedEmail={gmailConnection?.connected_email ?? null}
              clientEmail={quotation.client?.email ?? null}
              subject={quotationEmailDraft.subject}
              body={quotationEmailDraft.body}
              fromName={`${consultantFirstName} · Zenara Travel and Tours`}
              attachmentLabel={`${quotation.quotation_number}.pdf will be attached automatically`}
            />
            {isDraft && (
              <Link
                href={`/quotations/${id}/edit`}
                className="flex items-center gap-1.5 rounded-md border border-sand-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-sand-100"
              >
                <Pencil className="h-4 w-4" /> Edit
              </Link>
            )}
            {isDraft && <SendQuotationButton quotationId={id} />}
            {existingBooking ? (
              <Link
                href={`/bookings/${existingBooking.id}`}
                className="flex items-center gap-1.5 rounded-md bg-harbor-700 px-4 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600"
              >
                View booking ({existingBooking.booking_number})
              </Link>
            ) : (
              !isDraft && quotation.status === 'confirmed' && <ConvertToBookingButton quotationId={id} />
            )}
            {!isDraft && !['cancelled', 'lost', 'expired', 'paid'].includes(quotation.status) && (
              <Link
                href={`/quotations/${id}/revise`}
                className="flex items-center gap-1.5 rounded-md border border-sand-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-sand-100"
              >
                <Pencil className="h-4 w-4" /> Edit
              </Link>
            )}
            <DuplicateQuotationButton quotationId={id} />
            <ArchiveQuotationButton quotationId={id} quotationNumber={quotation.quotation_number} />
          </div>
        </div>

        {!isDraft && !['cancelled', 'lost', 'expired', 'confirmed', 'paid'].includes(quotation.status) && (
          <div className="mb-6 flex items-center justify-between rounded-lg border border-sand-200 bg-white px-4 py-3">
            <p className="text-sm text-ink-500">
              Once the client responds, update the quotation status to keep the dashboard and follow-ups accurate.
            </p>
            <QuotationStatusControls quotationId={id} status={quotation.status} />
          </div>
        )}

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-6">
            <section className="rounded-lg border border-sand-200 bg-white p-5">
              <h3 className="mb-3 font-display text-sm font-semibold text-ink-900">Trip overview</h3>
              <dl className="grid grid-cols-2 gap-y-2 text-sm">
                <Row label="Destination" value={currentVersion.destination} />
                <Row
                  label="Travel dates"
                  value={`${formatDate(currentVersion.travel_start_date)} – ${formatDate(currentVersion.travel_end_date)}`}
                />
                <Row label="Guests" value={`${currentVersion.num_adults} adults, ${currentVersion.num_children} children`} />
                <Row
                  label="Hotel"
                  value={
                    currentVersion.hotel_name
                      ? `${currentVersion.hotel_name} (${currentVersion.num_bedrooms ?? 0} bedrooms)`
                      : '—'
                  }
                />
              </dl>
            </section>

            <section className="rounded-lg border border-sand-200 bg-white p-5">
              <h3 className="mb-3 font-display text-sm font-semibold text-ink-900">Itinerary</h3>
              {itinerary.length === 0 && <p className="text-sm text-ink-500">No itinerary added.</p>}
              <div className="space-y-4">
                {itinerary.map((day) => (
                  <div key={day.id}>
                    <p className="font-ticket text-xs font-medium text-harbor-700">
                      Day {day.day_number}
                      {day.day_date ? ` — ${formatDate(day.day_date)}` : ''}
                    </p>
                    <p className="font-medium text-ink-900">{day.title}</p>
                    {day.description && <p className="text-sm text-ink-700">{day.description}</p>}
                    {day.activities?.length > 0 && (
                      <ul className="mt-1 list-inside list-disc text-sm text-ink-700">
                        {day.activities.map((a: string, i: number) => (
                          <li key={i}>{a}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <div className="grid grid-cols-2 gap-6">
              <section className="rounded-lg border border-sand-200 bg-white p-5">
                <h3 className="mb-2 font-display text-sm font-semibold text-ink-900">Inclusions</h3>
                <ul className="space-y-1 text-sm text-ink-700">
                  {inclusions.map((i) => (
                    <li key={i.id}>&bull; {i.item}</li>
                  ))}
                  {inclusions.length === 0 && <li className="text-ink-500">None listed.</li>}
                </ul>
              </section>
              <section className="rounded-lg border border-sand-200 bg-white p-5">
                <h3 className="mb-2 font-display text-sm font-semibold text-ink-900">Exclusions</h3>
                <ul className="space-y-1 text-sm text-ink-700">
                  {exclusions.map((e) => (
                    <li key={e.id}>&bull; {e.item}</li>
                  ))}
                  {exclusions.length === 0 && <li className="text-ink-500">None listed.</li>}
                </ul>
              </section>
            </div>
          </div>

          <div className="col-span-1 space-y-6">
            <section className="rounded-lg border border-sand-200 bg-white p-5">
              <h3 className="mb-3 font-display text-sm font-semibold text-ink-900">Client-facing price</h3>
              <p className="font-ticket text-2xl font-semibold text-ink-900">{formatMoney(currentVersion.total_price)}</p>
              {currentVersion.price_per_person && (
                <p className="text-sm text-ink-500">{formatMoney(currentVersion.price_per_person)} per person</p>
              )}
            </section>

            {pricing && (
              <section className="rounded-lg border border-coral-500/30 bg-coral-500/5 p-5">
                <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-coral-600">
                  Internal pricing — staff only
                </h3>
                <dl className="mt-3 space-y-1.5 text-sm">
                  <Row label="Supplier cost" value={formatMoney(pricing.supplier_cost)} />
                  <Row label="Markup" value={formatMoney(pricing.markup)} />
                  <Row label="Profit" value={formatMoney(pricing.profit)} />
                  <Row label="Margin" value={`${pricing.profit_margin_pct}%`} />
                </dl>
              </section>
            )}

            <section className="rounded-lg border border-sand-200 bg-white p-5">
              <h3 className="mb-3 font-display text-sm font-semibold text-ink-900">Version history</h3>
              <ul className="space-y-2">
                {versions.map((v) => (
                  <li key={v.id} className="flex items-center justify-between text-sm">
                    <span className={v.id === currentVersion.id ? 'font-medium text-ink-900' : 'text-ink-700'}>
                      {v.version_label}
                    </span>
                    <StatusBadge label={v.status} />
                  </li>
                ))}
              </ul>
            </section>

            {emailHistory.length > 0 && (
              <section className="rounded-lg border border-sand-200 bg-white p-5">
                <h3 className="mb-3 font-display text-sm font-semibold text-ink-900">Email history</h3>
                <ul className="space-y-3">
                  {emailHistory.map((e: any) => (
                    <li key={e.id} className="text-sm">
                      <p className="font-medium text-ink-900">
                        {e.email_type === 'followup' ? `Follow-up Email #${e.follow_up_number}` : 'Quotation Email'}
                      </p>
                      <p className="text-xs text-ink-500">
                        {formatDate(e.sent_at)} · Sent by {e.sent_by?.full_name ?? 'Unknown'}
                      </p>
                      <p className="text-xs text-ink-500">To: {e.recipient_email}</p>
                      <p className={`text-xs font-medium ${e.status === 'failed' ? 'text-coral-600' : 'text-harbor-600'}`}>
                        Status: {e.status === 'failed' ? 'Failed' : 'Sent'}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-ink-500">{label}</dt>
      <dd className="text-right text-ink-900">{value}</dd>
    </>
  );
}
