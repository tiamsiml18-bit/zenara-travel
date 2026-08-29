'use server';

import { revalidatePath } from 'next/cache';
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import { paymentSchema, bookingStatusSchema, type PaymentInput } from '@/lib/validation/booking';
import * as bookingsService from '@/lib/services/bookings';
import * as paymentsService from '@/lib/services/payments';
import * as quotationsService from '@/lib/services/quotations';

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

export async function convertToBookingAction(quotationId: string): Promise<ActionResult<{ bookingId: string }>> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  try {
    const { bookingId } = await bookingsService.convertQuotationToBooking(supabase, quotationId, user.id);
    revalidatePath('/bookings');
    revalidatePath(`/quotations/${quotationId}`);
    return { ok: true, data: { bookingId } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to create booking.' };
  }
}

export async function updateBookingStatusAction(input: { bookingId: string; status: string }): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = bookingStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid status.' };

  const supabase = await createSupabaseServerClient();
  try {
    await bookingsService.updateBookingStatus(supabase, parsed.data.bookingId, parsed.data.status, user.id);
    revalidatePath(`/bookings/${input.bookingId}`);
    revalidatePath('/bookings');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update booking status.' };
  }
}

export async function addPaymentAction(input: PaymentInput): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid payment details.' };
  }

  const supabase = await createSupabaseServerClient();
  try {
    await paymentsService.addPayment(supabase, parsed.data, user.id);
    revalidatePath(`/bookings/${input.bookingId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to record payment.' };
  }
}

/** Used from the quotation detail page to move a sent quotation to Negotiating/Confirmed/Cancelled/Lost/Expired. */
export async function updateQuotationStatusAction(input: { quotationId: string; status: string }): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  try {
    await quotationsService.updateQuotationStatus(supabase, input.quotationId, input.status, user.id);
    revalidatePath(`/quotations/${input.quotationId}`);
    revalidatePath('/quotations');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update status.' };
  }
}
