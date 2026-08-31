import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server-admin';
import { getEffectivePaymentDueDate } from '@/lib/services/payments';
import { sendPaymentReminderEmail } from '@/lib/services/email';
import { generatePaymentReminderEmail } from '@/lib/utils/email-templates';

export const dynamic = 'force-dynamic';

/**
 * Runs once daily (see vercel.json). For every Confirmed booking whose
 * effective payment due date is exactly tomorrow, with an outstanding
 * balance, reminders not stopped, and no reminder already sent today —
 * sends one reminder using the CURRENT payment record (amount paid,
 * remaining balance, due date, notes), never a cached or default value.
 * A completely separate flow from sales follow-ups: this only ever reads
 * Confirmed bookings, never touches quotation pipeline stages or the
 * follow-up sequence.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET) {
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } else {
    // No secret configured yet — refuse to run rather than send reminders
    // from an unauthenticated endpoint anyone could hit.
    return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 500 });
  }

  const supabase = createAdminClient();
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowIso = tomorrow.toISOString().slice(0, 10);

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select(
      `id, total_amount, travel_start_date, payment_due_date, payment_reminder_stopped, payment_reminder_sent_at, destination,
       client:clients ( id, full_name, email ),
       agent:users!bookings_assigned_agent_id_fkey ( full_name )`
    )
    .eq('status', 'confirmed')
    .is('deleted_at', null)
    .eq('payment_reminder_stopped', false);

  if (error) {
    console.error('[payment-reminders] failed to load bookings', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: { bookingId: string; outcome: string }[] = [];

  for (const raw of bookings ?? []) {
    const booking = raw as unknown as {
      id: string;
      total_amount: number;
      travel_start_date: string;
      payment_due_date: string | null;
      payment_reminder_stopped: boolean;
      payment_reminder_sent_at: string | null;
      destination: string;
      client: { id: string; full_name: string; email: string | null } | { id: string; full_name: string; email: string | null }[] | null;
      agent: { full_name: string } | { full_name: string }[] | null;
    };
    const client = Array.isArray(booking.client) ? booking.client[0] : booking.client;
    const agent = Array.isArray(booking.agent) ? booking.agent[0] : booking.agent;

    const effectiveDueDate = getEffectivePaymentDueDate(booking);
    if (effectiveDueDate !== tomorrowIso) continue; // only fires exactly 24 hours before due

    // Already sent today (idempotency guard in case the job runs more than once in a day)
    if (booking.payment_reminder_sent_at && booking.payment_reminder_sent_at.slice(0, 10) === todayIso) {
      results.push({ bookingId: booking.id, outcome: 'already_sent_today' });
      continue;
    }

    // Verify the CURRENT balance right before sending — never a stale/cached amount
    const { data: payments } = await supabase.from('payments').select('amount').eq('booking_id', booking.id);
    const totalPaid = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
    const remainingBalance = Math.max(0, Number(booking.total_amount) - totalPaid);

    if (remainingBalance <= 0) {
      results.push({ bookingId: booking.id, outcome: 'already_paid_in_full' });
      continue;
    }
    if (!client?.email) {
      results.push({ bookingId: booking.id, outcome: 'no_client_email' });
      continue;
    }

    const consultantFirstName = (agent?.full_name ?? 'Your consultant').split(' ')[0]!;
    const clientFirstName = client.full_name.split(' ')[0]!;
    const draft = generatePaymentReminderEmail({
      clientFirstName,
      destination: booking.destination,
      consultantFirstName,
      remainingBalance,
      dueDate: effectiveDueDate,
    });

    try {
      await sendPaymentReminderEmail(
        supabase,
        { bookingId: booking.id, clientId: client.id, to: client.email, subject: draft.subject, body: draft.body, consultantFirstName },
        null // system-sent, not attributable to a specific logged-in user
      );
      await supabase.from('bookings').update({ payment_reminder_sent_at: new Date().toISOString() }).eq('id', booking.id);
      results.push({ bookingId: booking.id, outcome: 'sent' });
    } catch (err) {
      results.push({ bookingId: booking.id, outcome: `failed: ${err instanceof Error ? err.message : 'unknown error'}` });
    }
  }

  return NextResponse.json({ checked: bookings?.length ?? 0, results });
}
