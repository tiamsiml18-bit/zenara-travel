import type { SupabaseClient } from '@supabase/supabase-js';
import { writeAudit } from './audit';
import { setClientStatusByName } from './clients';
import { unwrapToOne } from '@/lib/utils/unwrap-embed';

export interface BookingListFilters {
  status?: string;
  agentId?: string;
  page?: number;
  pageSize?: number;
}

const BOOKING_LIST_SELECT = `
  id, booking_number, destination, travel_start_date, travel_end_date, total_amount,
  payment_status, status, created_at,
  client:clients ( id, full_name ),
  agent:users!bookings_assigned_agent_id_fkey ( id, full_name ),
  quotation:quotations ( id, quotation_number )
`;

export async function listBookings(supabase: SupabaseClient, filters: BookingListFilters = {}) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('bookings')
    .select(BOOKING_LIST_SELECT, { count: 'exact' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.agentId) query = query.eq('assigned_agent_id', filters.agentId);

  const { data, error, count } = await query;
  if (error) throw new Error(`Failed to load bookings: ${error.message}`);
  const bookings = (data ?? []).map((b) => ({
    ...b,
    client: unwrapToOne(b.client),
    agent: unwrapToOne(b.agent),
    quotation: unwrapToOne(b.quotation),
  }));
  return { bookings, total: count ?? 0, page, pageSize };
}

export async function getBookingById(supabase: SupabaseClient, bookingId: string) {
  const { data, error } = await supabase
    .from('bookings')
    .select(
      `*, client:clients ( id, full_name, email, mobile_number ),
       agent:users!bookings_assigned_agent_id_fkey ( id, full_name ),
       quotation:quotations ( id, quotation_number )`
    )
    .eq('id', bookingId)
    .is('deleted_at', null)
    .single();
  if (error || !data) throw new Error('Booking not found.');
  return { ...data, client: unwrapToOne(data.client), agent: unwrapToOne(data.agent), quotation: unwrapToOne(data.quotation) };
}

export async function listBookingsByClient(supabase: SupabaseClient, clientId: string) {
  const { data, error } = await supabase
    .from('bookings')
    .select('id, booking_number, destination, status, payment_status, total_amount, travel_start_date')
    .eq('client_id', clientId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Converts a confirmed quotation into a booking. The quotation and its
 * versions are never modified — the booking simply references the
 * quotation's current (confirmed) version and copies its trip/price data
 * at the moment of conversion, matching the same "immutable snapshot"
 * philosophy used for quotation_versions.
 */
export async function convertQuotationToBooking(
  supabase: SupabaseClient,
  quotationId: string,
  actingUserId: string
) {
  const { data: quotation, error: qError } = await supabase
    .from('quotations')
    .select(
      `id, client_id, status, quotation_number, assigned_agent_id,
       current_version:quotation_versions!quotations_current_version_id_fkey (
         id, destination, travel_start_date, travel_end_date, total_price
       )`
    )
    .eq('id', quotationId)
    .single();
  if (qError || !quotation) throw new Error('Quotation not found.');
  if (quotation.status !== 'confirmed') {
    throw new Error('Only a confirmed quotation can be converted into a booking.');
  }
  const version = quotation.current_version as unknown as {
    id: string;
    destination: string;
    travel_start_date: string;
    travel_end_date: string;
    total_price: number;
  } | null;
  if (!version) throw new Error('Quotation has no version to convert.');

  const { data: bookingNumber, error: numError } = await supabase.rpc('allocate_booking_number');
  if (numError || !bookingNumber) throw new Error('Failed to allocate a booking number.');

  const { data: booking, error: insertError } = await supabase
    .from('bookings')
    .insert({
      booking_number: bookingNumber,
      client_id: quotation.client_id,
      quotation_id: quotation.id,
      quotation_version_id: version.id,
      destination: version.destination,
      travel_start_date: version.travel_start_date,
      travel_end_date: version.travel_end_date,
      total_amount: version.total_price,
      payment_status: 'unpaid',
      status: 'pending',
      assigned_agent_id: quotation.assigned_agent_id,
    })
    .select('id')
    .single();
  if (insertError || !booking) throw new Error(`Failed to create booking: ${insertError?.message}`);

  await supabase.from('client_activities').insert({
    client_id: quotation.client_id,
    activity_type: 'booking_created',
    description: `Booking ${bookingNumber} created from quotation ${quotation.quotation_number}.`,
    user_id: actingUserId,
    related_quotation_id: quotationId,
  });

  await writeAudit(supabase, {
    userId: actingUserId,
    action: 'booking.created',
    entityType: 'booking',
    entityId: booking.id,
    metadata: { quotationId, bookingNumber },
  });

  return { bookingId: booking.id as string, bookingNumber: bookingNumber as string };
}

export async function updateBookingStatus(
  supabase: SupabaseClient,
  bookingId: string,
  status: string,
  actingUserId: string
) {
  const { data: booking, error: fetchError } = await supabase
    .from('bookings')
    .select('client_id, booking_number')
    .eq('id', bookingId)
    .single();
  if (fetchError || !booking) throw new Error('Booking not found.');

  const { error } = await supabase.from('bookings').update({ status }).eq('id', bookingId);
  if (error) throw new Error(`Failed to update booking status: ${error.message}`);

  await writeAudit(supabase, {
    userId: actingUserId,
    action: 'booking.status_changed',
    entityType: 'booking',
    entityId: bookingId,
    metadata: { status },
  });

  // Completed bookings promote the client to Paid only if fully paid — see
  // recomputePaymentStatus, which is the source of truth for that check.
  if (status === 'cancelled') {
    await setClientStatusByName(supabase, booking.client_id, 'Cancelled', actingUserId);
  }
}
