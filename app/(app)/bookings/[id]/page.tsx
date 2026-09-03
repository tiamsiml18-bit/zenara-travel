import Link from 'next/link';
import { Topbar } from '@/components/layout/topbar';
import { StatusBadge } from '@/components/ui/status-badge';
import { BookingStatusSelect } from '@/components/bookings/booking-status-select';
import { AddPaymentForm } from '@/components/bookings/add-payment-form';
import { PaymentDetailsForm } from '@/components/bookings/payment-details-form';
import { createClient } from '@/lib/supabase/server';
import { getBookingById } from '@/lib/services/bookings';
import {
  listPayments,
  getEffectivePaymentDueDate,
  getPaymentDisplayStatus,
  getPaymentAuditHistory,
  PAYMENT_DISPLAY_STATUS_LABELS,
} from '@/lib/services/payments';
import { requireUser } from '@/lib/auth/session';

function formatDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}
function formatDateTime(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function formatMoney(n?: number | null) {
  if (n === null || n === undefined) return '—';
  return `PHP ${Number(n).toLocaleString('en-PH')}`;
}

const PAYMENT_STATUS_STYLE: Record<string, string> = {
  unpaid: 'bg-coral-500/10 text-coral-600',
  partial: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  paid: 'bg-harbor-100 text-harbor-700',
  refunded: 'bg-sand-100 text-ink-500',
};

const DISPLAY_STATUS_STYLE: Record<string, string> = {
  deposit_pending: 'bg-sand-100 text-ink-700',
  partially_paid: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  balance_due: 'bg-coral-500/10 text-coral-600',
  paid_in_full: 'bg-harbor-100 text-harbor-700',
};

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const supabase = await createClient();

  const [booking, payments, paymentHistory] = await Promise.all([
    getBookingById(supabase, id),
    listPayments(supabase, id),
    getPaymentAuditHistory(supabase, id),
  ]);

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const balance = Math.max(0, Number(booking.total_amount) - totalPaid);
  const effectiveDueDate = getEffectivePaymentDueDate(booking);
  const displayStatus = getPaymentDisplayStatus({
    paymentStatus: booking.payment_status,
    remainingBalance: balance,
    effectiveDueDate,
    todayIso: new Date().toISOString().slice(0, 10),
  });

  return (
    <>
      <Topbar title={booking.booking_number} showBack />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-ticket text-lg font-semibold text-ink-900">{booking.booking_number}</h2>
              <StatusBadge label={booking.status} />
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${PAYMENT_STATUS_STYLE[booking.payment_status] ?? ''}`}
              >
                {booking.payment_status}
              </span>
              {booking.status === 'confirmed' && (
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${DISPLAY_STATUS_STYLE[displayStatus]}`}>
                  {PAYMENT_DISPLAY_STATUS_LABELS[displayStatus]}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-ink-500">
              {booking.client?.full_name} · {booking.destination} · agent: {booking.agent?.full_name ?? '—'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/clients/${booking.client_id}`}
              className="rounded-md border border-sand-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-sand-100"
            >
              View client
            </Link>
            <Link
              href={`/quotations/${booking.quotation_id}`}
              className="rounded-md border border-sand-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-sand-100"
            >
              View quotation
            </Link>
            <BookingStatusSelect bookingId={id} status={booking.status} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-6">
            <section className="rounded-lg border border-sand-200 bg-surface p-5">
              <h3 className="mb-3 font-display text-sm font-semibold text-ink-900">Trip</h3>
              <dl className="grid grid-cols-2 gap-y-2 text-sm">
                <Row label="Destination" value={booking.destination} />
                <Row
                  label="Travel dates"
                  value={`${formatDate(booking.travel_start_date)} – ${formatDate(booking.travel_end_date)}`}
                />
                <Row label="Quotation" value={booking.quotation?.quotation_number ?? '—'} />
                <Row label="Booked" value={formatDate(booking.created_at)} />
              </dl>
              {booking.notes && (
                <p className="mt-3 rounded bg-sand-50 px-3 py-2 text-sm text-ink-700">{booking.notes}</p>
              )}
            </section>

            <section className="rounded-lg border border-sand-200 bg-surface p-5">
              <h3 className="mb-3 font-display text-sm font-semibold text-ink-900">Payment history</h3>
              {payments.length === 0 && <p className="text-sm text-ink-500">No payments recorded yet.</p>}
              <ul className="space-y-2">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between border-b border-sand-100 pb-2 text-sm last:border-0">
                    <div>
                      <p className="font-ticket font-medium text-ink-900">{formatMoney(p.amount)}</p>
                      <p className="text-xs text-ink-500">
                        {formatDate(p.payment_date)} · {p.method}
                        {p.recorded_by?.full_name ? ` · recorded by ${p.recorded_by.full_name}` : ''}
                      </p>
                      {p.notes && <p className="mt-0.5 text-xs text-ink-500">{p.notes}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {paymentHistory.length > 0 && (
              <section className="rounded-lg border border-sand-200 bg-surface p-5">
                <h3 className="mb-3 font-display text-sm font-semibold text-ink-900">Payment change history</h3>
                <ul className="space-y-3">
                  {paymentHistory.map((entry) => (
                    <li key={entry.id} className="text-sm">
                      <p className="text-xs text-ink-500">
                        {formatDateTime(entry.created_at)}
                        {entry.user?.full_name ? ` · ${entry.user.full_name}` : ''}
                      </p>
                      {entry.action === 'payment.added' ? (
                        <p className="text-ink-700">
                          Payment of {formatMoney((entry.metadata as any)?.amount)} recorded via {(entry.metadata as any)?.method}.
                        </p>
                      ) : (
                        <ul className="mt-0.5 space-y-0.5 text-ink-700">
                          {((entry.metadata as any)?.changes ?? []).map((c: any, i: number) => (
                            <li key={i}>
                              {c.label} changed{c.from ? ` from "${c.from}"` : ''} to "{c.to ?? '—'}"
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <div className="col-span-1 space-y-6">
            <section className="rounded-lg border border-sand-200 bg-surface p-5">
              <h3 className="mb-3 font-display text-sm font-semibold text-ink-900">Balance</h3>
              <dl className="grid grid-cols-2 gap-y-2 text-sm">
                <Row label="Total package" value={formatMoney(booking.total_amount)} />
                <Row label="Amount paid" value={formatMoney(totalPaid)} />
                <Row label="Balance" value={formatMoney(balance)} />
              </dl>
            </section>

            <AddPaymentForm bookingId={id} />

            {booking.status === 'confirmed' && (
              <PaymentDetailsForm
                bookingId={id}
                paymentNotes={booking.payment_notes}
                paymentDueDate={booking.payment_due_date}
                effectiveDueDate={effectiveDueDate}
                usingDefaultDueDate={!booking.payment_due_date}
                reminderStopped={booking.payment_reminder_stopped}
              />
            )}

            <p className="text-xs leading-relaxed text-ink-500">
              This is a lightweight tracker for reference only — detailed accounting stays in Zoho, per agency
              policy.
            </p>
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
