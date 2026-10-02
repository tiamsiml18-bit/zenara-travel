import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server-admin';
import { createDraftForBooking } from '@/lib/services/detailed-itineraries';

export const dynamic = 'force-dynamic';

/**
 * Runs once daily (see vercel.json), same schedule slot as
 * payment-reminders. For every booking that is Confirmed + fully Paid and
 * exactly 14 days from departure, creates a draft Detailed Itinerary if
 * one doesn't already exist — never sends anything, never touches a
 * booking that is unpaid, partially paid, or cancelled.
 *
 * Idempotency: this is safe to run more than once a day (or more than
 * once for the same booking, ever) because createDraftForBooking() is
 * itself idempotent — backed by the `detailed_itineraries_one_per_booking`
 * unique constraint in the database, not just the "no existing row" check
 * here. Running this job twice produces the exact same end state as
 * running it once.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET) {
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } else {
    // No secret configured — refuse to run rather than generate drafts
    // from an unauthenticated endpoint anyone could hit. Same posture as
    // payment-reminders.
    return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 500 });
  }

  const supabase = createAdminClient();

  const today = new Date();
  const targetDate = new Date(today);
  targetDate.setUTCDate(targetDate.getUTCDate() + 14);
  const targetIso = targetDate.toISOString().slice(0, 10);

  // Deliberately exact-date match (the booking's own travel_start_date is
  // exactly 14 days out today), not a <= range — mirrors the
  // payment-reminders job's "fires exactly once, on the one day it's due"
  // pattern, so a booking is only ever considered on this one day rather
  // than re-evaluated (and re-logged) on every day up to departure.
  //
  // Only `status = 'confirmed'` AND `payment_status = 'paid'` — explicitly
  // excludes unpaid, partial, and cancelled bookings. Partially paid
  // bookings are deliberately NOT drafted in this first version, even
  // though they may still be close to departure; see the architecture
  // investigation's risk notes on this.
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, booking_number, travel_start_date')
    .eq('status', 'confirmed')
    .eq('payment_status', 'paid')
    .eq('travel_start_date', targetIso)
    .is('deleted_at', null);

  if (error) {
    console.error('[detailed-itineraries cron] failed to load bookings', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: { bookingId: string; bookingNumber: string; outcome: string }[] = [];

  for (const booking of bookings ?? []) {
    try {
      // actingUserId = null: this is a system-generated draft, not
      // attributable to a specific logged-in agent — createDraftForBooking
      // skips the audit-log write in that case (there's no user to blame
      // it on) but the row's own created_by stays null, which is itself
      // the signal that automation created it.
      const { created } = await createDraftForBooking(supabase, booking.id, null);
      results.push({
        bookingId: booking.id,
        bookingNumber: booking.booking_number,
        outcome: created ? 'draft_created' : 'already_existed',
      });
    } catch (err) {
      results.push({
        bookingId: booking.id,
        bookingNumber: booking.booking_number,
        outcome: `failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      });
    }
  }

  return NextResponse.json({ checked: bookings?.length ?? 0, targetDate: targetIso, results });
}
