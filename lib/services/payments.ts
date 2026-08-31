import type { SupabaseClient } from '@supabase/supabase-js';
import type { PaymentInput } from '@/lib/validation/booking';
import { writeAudit, diffFields, writeFieldChangeAudit } from './audit';
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

// ============================================================================
// Payment reminder support — due date, display status, and the agent's
// payment-arrangement notes. Deliberately layered ON TOP of the existing
// payments-ledger system above (addPayment/recomputePaymentStatus), never
// replacing it: Amount Paid and Remaining Balance still come from the sum
// of recorded payments vs total_amount, exactly as the spec requires.
// ============================================================================

export type PaymentDisplayStatus = 'deposit_pending' | 'partially_paid' | 'balance_due' | 'paid_in_full';

export const PAYMENT_DISPLAY_STATUS_LABELS: Record<PaymentDisplayStatus, string> = {
  deposit_pending: 'Deposit Pending',
  partially_paid: 'Partially Paid',
  balance_due: 'Balance Due',
  paid_in_full: 'Paid in Full',
};

/** The system default when no due date has been manually recorded — 14 days before travel. */
export function computeDefaultPaymentDueDate(travelStartDate: string): string {
  const d = new Date(`${travelStartDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 14);
  return d.toISOString().slice(0, 10);
}

/**
 * The due date actually in effect for this booking — the agent's manual
 * override when one is recorded, otherwise the 14-days-before-travel
 * default. This is the ONE function anything that needs "when is the
 * balance due" should call, so a manually recorded date is never silently
 * ignored in favor of the default.
 */
export function getEffectivePaymentDueDate(booking: { payment_due_date: string | null; travel_start_date: string }): string {
  return booking.payment_due_date ?? computeDefaultPaymentDueDate(booking.travel_start_date);
}

/**
 * Derives the four spec statuses from the EXISTING payment_status enum
 * (unpaid/partial/paid — already correctly computed elsewhere from the
 * payments ledger, see recomputePaymentStatus above) plus whether the
 * effective due date has arrived. A pure computed label, never a second
 * stored value that could fall out of sync with the actual payment record.
 */
export function getPaymentDisplayStatus(params: {
  paymentStatus: string;
  remainingBalance: number;
  effectiveDueDate: string;
  todayIso: string;
}): PaymentDisplayStatus {
  if (params.paymentStatus === 'paid' || params.remainingBalance <= 0) return 'paid_in_full';
  if (params.paymentStatus === 'unpaid') return 'deposit_pending';
  return params.effectiveDueDate <= params.todayIso ? 'balance_due' : 'partially_paid';
}

export interface PaymentDetailsUpdate {
  paymentNotes?: string | null;
  paymentDueDate?: string | null;
  reminderStopped?: boolean;
}

/**
 * Updates the agent-editable payment fields — due date, arrangement notes,
 * and the manual reminder stop switch. Writes one audit entry per changed
 * field (via the existing writeFieldChangeAudit helper), so the team can
 * always see why a reminder amount or date changed, per spec.
 */
export async function updatePaymentDetails(
  supabase: SupabaseClient,
  bookingId: string,
  updates: PaymentDetailsUpdate,
  actingUserId: string
) {
  const { data: before, error: fetchError } = await supabase
    .from('bookings')
    .select('payment_notes, payment_due_date, payment_reminder_stopped')
    .eq('id', bookingId)
    .single();
  if (fetchError || !before) throw new Error('Booking not found.');

  const patch: Record<string, unknown> = {};
  if (updates.paymentNotes !== undefined) patch.payment_notes = updates.paymentNotes || null;
  if (updates.paymentDueDate !== undefined) patch.payment_due_date = updates.paymentDueDate || null;
  if (updates.reminderStopped !== undefined) patch.payment_reminder_stopped = updates.reminderStopped;

  const { error } = await supabase.from('bookings').update(patch).eq('id', bookingId);
  if (error) throw new Error(`Failed to update payment details: ${error.message}`);

  const after = { ...before, ...patch };
  const changes = diffFields(before, after, {
    payment_notes: 'Payment notes',
    payment_due_date: 'Payment due date',
    payment_reminder_stopped: 'Payment reminder stopped',
  });
  await writeFieldChangeAudit(supabase, { userId: actingUserId, entityType: 'booking', entityId: bookingId, changes });
}

/** Audit trail for a single booking — payments recorded and payment-detail edits, newest first, for the "why did this reminder change" view. */
export async function getPaymentAuditHistory(supabase: SupabaseClient, bookingId: string) {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, action, metadata, created_at, user:users(full_name)')
    .eq('entity_type', 'booking')
    .eq('entity_id', bookingId)
    .in('action', ['booking.updated', 'payment.added'])
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Failed to load payment history: ${error.message}`);
  return (data ?? []).map((row) => ({ ...row, user: unwrapToOne(row.user) }));
}
