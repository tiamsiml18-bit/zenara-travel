import type { SupabaseClient } from '@supabase/supabase-js';
import type { PaymentInput } from '@/lib/validation/booking';
import { writeAudit } from './audit';
import { setClientStatusByName } from './clients';
import { unwrapToOne } from '@/lib/utils/unwrap-embed';

export async function listPayments(supabase: SupabaseClient, bookingId: string) {
  const { data, error } = await supabase
    .from('payments')
    .select('id, amount, payment_date, method, notes, created_at, recorded_by:users ( full_name )')
    .eq('booking_id', bookingId)
    .order('payment_date', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => ({ ...p, recorded_by: unwrapToOne(p.recorded_by) }));
}

/**
 * Recomputes payment_status from the sum of recorded payments vs the
 * booking's total_amount. This is the single source of truth for
 * unpaid/partial/paid — nothing else should set payment_status directly.
 */
async function recomputePaymentStatus(supabase: SupabaseClient, bookingId: string) {
  const [{ data: booking }, { data: payments }] = await Promise.all([
    supabase.from('bookings').select('total_amount, client_id').eq('id', bookingId).single(),
    supabase.from('payments').select('amount').eq('booking_id', bookingId),
  ]);
  if (!booking) return;

  const totalPaid = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  const status = totalPaid <= 0 ? 'unpaid' : totalPaid >= Number(booking.total_amount) ? 'paid' : 'partial';

  await supabase.from('bookings').update({ payment_status: status }).eq('id', bookingId);
  return { totalPaid, status, balance: Math.max(0, Number(booking.total_amount) - totalPaid), clientId: booking.client_id };
}

export async function addPayment(supabase: SupabaseClient, input: PaymentInput, actingUserId: string) {
  const { error } = await supabase.from('payments').insert({
    booking_id: input.bookingId,
    amount: input.amount,
    payment_date: input.paymentDate,
    method: input.method,
    notes: input.notes || null,
    recorded_by: actingUserId,
  });
  if (error) throw new Error(`Failed to record payment: ${error.message}`);

  const result = await recomputePaymentStatus(supabase, input.bookingId);

  if (result) {
    await supabase.from('client_activities').insert({
      client_id: result.clientId,
      activity_type: 'payment_added',
      description: `Payment of PHP ${input.amount.toLocaleString('en-PH')} recorded via ${input.method}.`,
      user_id: actingUserId,
    });

    // A fully paid booking promotes the client's status, matching the spec's
    // "When the client confirms" style mapping — paid is the natural end state.
    if (result.status === 'paid') {
      await setClientStatusByName(supabase, result.clientId, 'Paid', actingUserId);
    }
  }

  await writeAudit(supabase, {
    userId: actingUserId,
    action: 'payment.added',
    entityType: 'booking',
    entityId: input.bookingId,
    metadata: { amount: input.amount, method: input.method },
  });

  return result;
}
