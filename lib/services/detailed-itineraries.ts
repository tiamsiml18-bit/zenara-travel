import type { SupabaseClient } from '@supabase/supabase-js';
import { writeAudit } from './audit';
import { unwrapToOne } from '@/lib/utils/unwrap-embed';
import type {
  DetailedItineraryStatus,
  OperationalFieldsInput,
  FlightDetailInput,
  DailyDetailInput,
  TransferInput,
} from '@/lib/validation/detailed-itinerary';

// ============================================================================
// New, standalone feature. Nothing in this file writes to quotations,
// quotation_versions, bookings, or payments — it only ever reads them.
//
// Golden rule (see the approved architecture investigation): every read of
// quotation content goes through bookings.quotation_version_id, the
// booking's own frozen snapshot of what the client paid for — never
// quotations.current_version_id, which may have moved on to a later,
// unconfirmed revision. getInheritedQuotationData() below is the ONLY
// place that resolves "which quotation version does this booking's
// itinerary come from," so every other function in this file reaches
// quotation content through it rather than re-deriving the version id.
// ============================================================================

const ELIGIBLE_BOOKING_STATUS = 'confirmed';
const ELIGIBLE_PAYMENT_STATUS = 'paid';

export function isBookingEligibleForDraft(booking: { status: string; payment_status: string }): boolean {
  return booking.status === ELIGIBLE_BOOKING_STATUS && booking.payment_status === ELIGIBLE_PAYMENT_STATUS;
}

/** 14 days before travel_start_date, in UTC, as an ISO date (YYYY-MM-DD) — same math as computeDefaultPaymentDueDate in lib/services/payments.ts, applied to a different field for a different purpose. */
export function computeDraftGenerationDate(travelStartDate: string): string {
  const d = new Date(`${travelStartDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 14);
  return d.toISOString().slice(0, 10);
}

/**
 * Every quotation-sourced field a Detailed Itinerary can show, resolved
 * through the booking's frozen quotation_version_id. Read-only — never
 * writes anything. Throws if the booking (or its frozen version) can't be
 * found; callers decide how to surface that.
 */
export async function getInheritedQuotationData(supabase: SupabaseClient, bookingId: string) {
  const { data: booking, error: bError } = await supabase
    .from('bookings')
    .select(
      `id, booking_number, status, payment_status, destination, travel_start_date, travel_end_date, total_amount,
       quotation_id, quotation_version_id,
       client:clients ( id, full_name, email, mobile_number, whatsapp_number ),
       agent:users!bookings_assigned_agent_id_fkey ( id, full_name, email, phone )`
    )
    .eq('id', bookingId)
    .is('deleted_at', null)
    .single();
  if (bError || !booking) throw new Error('Booking not found.');

  // Deliberately bookings.quotation_version_id, never
  // quotations.current_version_id — see the file header.
  const { data: version, error: vError } = await supabase
    .from('quotation_versions')
    .select(
      `id, quotation_id, version_label, client_name_snapshot, destination, travel_start_date, travel_end_date,
       num_adults, num_children, num_seniors, num_infants, num_pwd,
       hotel_name, num_bedrooms, consultant_name_snapshot`
    )
    .eq('id', booking.quotation_version_id)
    .single();
  if (vError || !version) throw new Error("The booking's quotation version could not be found.");

  const { data: quotation } = await supabase
    .from('quotations')
    .select('id, quotation_number, package_id, package:packages ( name )')
    .eq('id', booking.quotation_id)
    .single();

  const [{ data: itinerary }, { data: inclusions }, { data: exclusions }, { data: flightSegments }] = await Promise.all([
    supabase
      .from('quotation_itinerary_days')
      .select('id, day_number, day_date, title, description, activities')
      .eq('quotation_version_id', version.id)
      .order('day_number'),
    supabase.from('quotation_inclusions').select('item').eq('quotation_version_id', version.id).order('sort_order'),
    supabase.from('quotation_exclusions').select('item').eq('quotation_version_id', version.id).order('sort_order'),
    supabase
      .from('quotation_flight_segments')
      .select('id, airline, flight_number, departure, arrival, departure_time, arrival_time, route')
      .eq('quotation_version_id', version.id)
      .order('sort_order'),
  ]);

  const client = unwrapToOne(booking.client) as {
    id: string;
    full_name: string;
    email: string | null;
    mobile_number: string | null;
    whatsapp_number: string | null;
  } | null;
  const agent = unwrapToOne(booking.agent) as { id: string; full_name: string; email: string | null; phone: string | null } | null;
  const linkedPackage = quotation ? (unwrapToOne(quotation.package) as { name: string } | null) : null;

  return {
    booking: {
      id: booking.id as string,
      bookingNumber: booking.booking_number as string,
      status: booking.status as string,
      paymentStatus: booking.payment_status as string,
      destination: booking.destination as string,
      travelStartDate: booking.travel_start_date as string,
      travelEndDate: booking.travel_end_date as string,
      totalAmount: Number(booking.total_amount),
    },
    quotationNumber: (quotation?.quotation_number as string) ?? null,
    packageName: linkedPackage?.name ?? null,
    client: client
      ? { name: client.full_name, email: client.email, mobileNumber: client.mobile_number, whatsappNumber: client.whatsapp_number }
      : null,
    // Consultant snapshot on the version takes precedence, same precedence
    // rule already proven in getQuotationPdfData() — falls back to the
    // assigned agent for quotations created before per-trip consultant
    // selection existed.
    consultant: {
      name: (version.consultant_name_snapshot as string | null) ?? agent?.full_name ?? null,
      email: agent?.email ?? null,
      phone: agent?.phone ?? null,
    },
    trip: {
      destination: version.destination as string,
      travelStartDate: version.travel_start_date as string,
      travelEndDate: version.travel_end_date as string,
      numAdults: version.num_adults as number,
      numChildren: version.num_children as number,
      numSeniors: (version.num_seniors as number) ?? 0,
      numInfants: (version.num_infants as number) ?? 0,
      numPwd: (version.num_pwd as number) ?? 0,
      hotelName: version.hotel_name as string | null,
      numBedrooms: version.num_bedrooms as number | null,
    },
    itinerary: (itinerary ?? []).map((d) => ({
      id: d.id as string,
      dayNumber: d.day_number as number,
      dayDate: d.day_date as string | null,
      title: d.title as string,
      description: d.description as string | null,
      activities: (d.activities as string[]) ?? [],
    })),
    inclusions: (inclusions ?? []).map((i) => i.item as string),
    exclusions: (exclusions ?? []).map((e) => e.item as string),
    flightSegments: (flightSegments ?? []).map((f) => ({
      id: f.id as string,
      airline: f.airline as string,
      flightNumber: f.flight_number as string,
      departure: f.departure as string,
      arrival: f.arrival as string,
      departureTime: f.departure_time as string,
      arrivalTime: f.arrival_time as string,
      route: f.route as string,
    })),
  };
}

export type InheritedQuotationData = Awaited<ReturnType<typeof getInheritedQuotationData>>;

const PARENT_SELECT = `
  id, booking_id, status, generated_at, approved_by, approved_at, sent_at,
  airport_instructions, contact_instructions, important_reminders, guide_instructions,
  hotel_address, hotel_phone, hotel_checkin_info, hotel_confirmation_number, hotel_booking_number, hotel_pin,
  custom_notes, created_by, created_at, updated_at
`;

export async function getDetailedItineraryByBooking(supabase: SupabaseClient, bookingId: string) {
  const { data, error } = await supabase.from('detailed_itineraries').select(PARENT_SELECT).eq('booking_id', bookingId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getDetailedItineraryById(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase.from('detailed_itineraries').select(PARENT_SELECT).eq('id', id).single();
  if (error || !data) throw new Error('Detailed itinerary not found.');
  return data;
}

/** Full detail view: the operational record, its child rows, and everything inherited from the quotation — the one call the detail page needs. */
export async function getDetailedItineraryDetail(supabase: SupabaseClient, id: string) {
  const parent = await getDetailedItineraryById(supabase, id);

  const [{ data: flightDetails }, { data: dailyDetails }, { data: transfers }, inherited] = await Promise.all([
    supabase
      .from('detailed_itinerary_flight_details')
      .select('id, quotation_flight_segment_id, booking_reference, terminal, special_instructions')
      .eq('detailed_itinerary_id', id),
    supabase
      .from('detailed_itinerary_daily_details')
      .select('id, quotation_itinerary_day_id, pickup_time, meeting_point, meals, free_time, operational_notes')
      .eq('detailed_itinerary_id', id),
    supabase
      .from('detailed_itinerary_transfers')
      .select('id, sort_order, pickup_location, pickup_time, driver_guide_name, contact_number, meeting_point, vehicle_info')
      .eq('detailed_itinerary_id', id)
      .order('sort_order'),
    getInheritedQuotationData(supabase, parent.booking_id as string),
  ]);

  return {
    ...parent,
    inherited,
    flightDetails: flightDetails ?? [],
    dailyDetails: dailyDetails ?? [],
    transfers: transfers ?? [],
  };
}

export interface DetailedItineraryListFilters {
  status?: DetailedItineraryStatus;
  page?: number;
  pageSize?: number;
}

/** List view data — one row per Detailed Itinerary, joined to its booking for destination/client/dates/payment status. */
export async function listDetailedItineraries(supabase: SupabaseClient, filters: DetailedItineraryListFilters = {}) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('detailed_itineraries')
    .select(
      `id, status, generated_at, sent_at,
       booking:bookings ( id, booking_number, destination, travel_start_date, travel_end_date,
         client:clients ( full_name ) )`,
      { count: 'exact' }
    )
    .order('generated_at', { ascending: false })
    .range(from, to);

  if (filters.status) query = query.eq('status', filters.status);

  const { data, error, count } = await query;
  if (error) throw new Error(`Failed to load detailed itineraries: ${error.message}`);

  const rows = (data ?? []).map((row) => {
    const booking = unwrapToOne(row.booking) as {
      id: string;
      booking_number: string;
      destination: string;
      travel_start_date: string;
      travel_end_date: string;
      client: { full_name: string } | { full_name: string }[] | null;
    } | null;
    const client = booking ? unwrapToOne(booking.client) : null;
    return {
      id: row.id as string,
      status: row.status as DetailedItineraryStatus,
      generatedAt: row.generated_at as string,
      sentAt: row.sent_at as string | null,
      booking: booking
        ? {
            id: booking.id,
            bookingNumber: booking.booking_number,
            destination: booking.destination,
            travelStartDate: booking.travel_start_date,
            travelEndDate: booking.travel_end_date,
            clientName: client?.full_name ?? null,
          }
        : null,
    };
  });

  return { itineraries: rows, total: count ?? 0, page, pageSize };
}

/**
 * Creates a draft Detailed Itinerary for a booking, if one doesn't already
 * exist. Used by both the 14-day cron job (system-generated) and an
 * agent's manual "create now" action, if offered. Idempotent by
 * construction: the unique constraint on detailed_itineraries.booking_id
 * (0007_detailed_itineraries.sql) is what actually prevents a duplicate,
 * not application-level logic alone — a 23505 (unique_violation) here
 * means another call already created one, which is treated as success,
 * not an error.
 */
export async function createDraftForBooking(supabase: SupabaseClient, bookingId: string, actingUserId: string | null) {
  const { data: existing } = await supabase.from('detailed_itineraries').select('id').eq('booking_id', bookingId).maybeSingle();
  if (existing) return { id: existing.id as string, created: false };

  const { data, error } = await supabase
    .from('detailed_itineraries')
    .insert({ booking_id: bookingId, created_by: actingUserId })
    .select('id')
    .single();

  if (error) {
    // 23505 = unique_violation — a concurrent call (e.g. the cron job
    // running twice) already created the row; that's success, not failure.
    if (error.code === '23505') {
      const { data: raceWinner } = await supabase.from('detailed_itineraries').select('id').eq('booking_id', bookingId).single();
      if (raceWinner) return { id: raceWinner.id as string, created: false };
    }
    throw new Error(`Failed to create detailed itinerary: ${error.message}`);
  }

  if (actingUserId) {
    await writeAudit(supabase, {
      userId: actingUserId,
      action: 'detailed_itinerary.created',
      entityType: 'detailed_itinerary',
      entityId: data.id as string,
      metadata: { bookingId },
    });
  }

  return { id: data.id as string, created: true };
}

/**
 * Updates the agent-editable operational fields (Travel Reminders, Hotel,
 * custom notes). If the record was already `sent`, editing it afterward
 * moves it to `updated` — a side effect of the edit itself, not a status
 * the agent picks from a menu, so a sent itinerary can never silently
 * drift out of sync with what the client actually received without that
 * becoming visible.
 */
export async function updateOperationalFields(
  supabase: SupabaseClient,
  input: OperationalFieldsInput,
  actingUserId: string
) {
  const { data: current, error: fetchError } = await supabase
    .from('detailed_itineraries')
    .select('status')
    .eq('id', input.detailedItineraryId)
    .single();
  if (fetchError || !current) throw new Error('Detailed itinerary not found.');

  const patch: Record<string, unknown> = {
    airport_instructions: input.airportInstructions || null,
    contact_instructions: input.contactInstructions || null,
    important_reminders: input.importantReminders || null,
    guide_instructions: input.guideInstructions || null,
    hotel_address: input.hotelAddress || null,
    hotel_phone: input.hotelPhone || null,
    hotel_checkin_info: input.hotelCheckinInfo || null,
    hotel_confirmation_number: input.hotelConfirmationNumber || null,
    hotel_booking_number: input.hotelBookingNumber || null,
    hotel_pin: input.hotelPin || null,
    custom_notes: input.customNotes || null,
  };
  if (current.status === 'sent') patch.status = 'updated';

  const { error } = await supabase.from('detailed_itineraries').update(patch).eq('id', input.detailedItineraryId);
  if (error) throw new Error(`Failed to save operational details: ${error.message}`);

  await writeAudit(supabase, {
    userId: actingUserId,
    action: 'detailed_itinerary.operational_fields_updated',
    entityType: 'detailed_itinerary',
    entityId: input.detailedItineraryId,
    metadata: { movedToUpdated: current.status === 'sent' },
  });
}

async function markUpdatedIfSent(supabase: SupabaseClient, detailedItineraryId: string) {
  const { data } = await supabase.from('detailed_itineraries').select('status').eq('id', detailedItineraryId).single();
  if (data?.status === 'sent') {
    await supabase.from('detailed_itineraries').update({ status: 'updated' }).eq('id', detailedItineraryId);
  }
}

/** Replaces all flight operational rows for this itinerary — same delete-then-insert pattern as the quotation child tables. Every row must reference a flight segment that actually belongs to this booking's frozen quotation version; the caller (the server action) is responsible for only ever submitting segment ids taken from getInheritedQuotationData() for the same booking. */
export async function replaceFlightDetails(supabase: SupabaseClient, detailedItineraryId: string, rows: FlightDetailInput[], actingUserId: string) {
  await supabase.from('detailed_itinerary_flight_details').delete().eq('detailed_itinerary_id', detailedItineraryId);
  if (rows.length > 0) {
    const { error } = await supabase.from('detailed_itinerary_flight_details').insert(
      rows.map((r) => ({
        detailed_itinerary_id: detailedItineraryId,
        quotation_flight_segment_id: r.quotationFlightSegmentId,
        booking_reference: r.bookingReference || null,
        terminal: r.terminal || null,
        special_instructions: r.specialInstructions || null,
      }))
    );
    if (error) throw new Error(`Failed to save flight details: ${error.message}`);
  }
  await markUpdatedIfSent(supabase, detailedItineraryId);
  await writeAudit(supabase, {
    userId: actingUserId,
    action: 'detailed_itinerary.flight_details_updated',
    entityType: 'detailed_itinerary',
    entityId: detailedItineraryId,
  });
}

export async function replaceDailyDetails(supabase: SupabaseClient, detailedItineraryId: string, rows: DailyDetailInput[], actingUserId: string) {
  await supabase.from('detailed_itinerary_daily_details').delete().eq('detailed_itinerary_id', detailedItineraryId);
  if (rows.length > 0) {
    const { error } = await supabase.from('detailed_itinerary_daily_details').insert(
      rows.map((r) => ({
        detailed_itinerary_id: detailedItineraryId,
        quotation_itinerary_day_id: r.quotationItineraryDayId,
        pickup_time: r.pickupTime || null,
        meeting_point: r.meetingPoint || null,
        meals: r.meals || null,
        free_time: r.freeTime || null,
        operational_notes: r.operationalNotes || null,
      }))
    );
    if (error) throw new Error(`Failed to save daily details: ${error.message}`);
  }
  await markUpdatedIfSent(supabase, detailedItineraryId);
  await writeAudit(supabase, {
    userId: actingUserId,
    action: 'detailed_itinerary.daily_details_updated',
    entityType: 'detailed_itinerary',
    entityId: detailedItineraryId,
  });
}

export async function replaceTransfers(supabase: SupabaseClient, detailedItineraryId: string, rows: TransferInput[], actingUserId: string) {
  await supabase.from('detailed_itinerary_transfers').delete().eq('detailed_itinerary_id', detailedItineraryId);
  if (rows.length > 0) {
    const { error } = await supabase.from('detailed_itinerary_transfers').insert(
      rows.map((r, i) => ({
        detailed_itinerary_id: detailedItineraryId,
        sort_order: i,
        pickup_location: r.pickupLocation || null,
        pickup_time: r.pickupTime || null,
        driver_guide_name: r.driverGuideName || null,
        contact_number: r.contactNumber || null,
        meeting_point: r.meetingPoint || null,
        vehicle_info: r.vehicleInfo || null,
      }))
    );
    if (error) throw new Error(`Failed to save transfers: ${error.message}`);
  }
  await markUpdatedIfSent(supabase, detailedItineraryId);
  await writeAudit(supabase, {
    userId: actingUserId,
    action: 'detailed_itinerary.transfers_updated',
    entityType: 'detailed_itinerary',
    entityId: detailedItineraryId,
  });
}

// Explicit, one-directional-by-default transitions. 'sent' is only ever
// reached through this function, from 'approved', via a deliberate agent
// action — there is no automated path anywhere in this feature that can
// set a record to 'sent'.
const ALLOWED_TRANSITIONS: Record<DetailedItineraryStatus, DetailedItineraryStatus[]> = {
  draft: ['ready_for_review'],
  ready_for_review: ['draft', 'approved'],
  approved: ['ready_for_review', 'sent'],
  sent: [],
  updated: ['ready_for_review', 'approved'],
};

/**
 * Moves a Detailed Itinerary to the next status in its agent-driven review
 * workflow. Every transition is an explicit, logged action by a named
 * agent — nothing in this feature calls this function to reach `sent`
 * except a real person clicking "Send to Client".
 */
export async function transitionStatus(
  supabase: SupabaseClient,
  detailedItineraryId: string,
  nextStatus: DetailedItineraryStatus,
  actingUserId: string
) {
  const { data: current, error: fetchError } = await supabase
    .from('detailed_itineraries')
    .select('status')
    .eq('id', detailedItineraryId)
    .single();
  if (fetchError || !current) throw new Error('Detailed itinerary not found.');

  const currentStatus = current.status as DetailedItineraryStatus;
  if (!ALLOWED_TRANSITIONS[currentStatus].includes(nextStatus)) {
    throw new Error(`Cannot move a Detailed Itinerary from "${currentStatus}" to "${nextStatus}".`);
  }

  const patch: Record<string, unknown> = { status: nextStatus };
  if (nextStatus === 'approved') {
    patch.approved_by = actingUserId;
    patch.approved_at = new Date().toISOString();
  }
  if (nextStatus === 'sent') {
    patch.sent_at = new Date().toISOString();
  }

  const { error } = await supabase.from('detailed_itineraries').update(patch).eq('id', detailedItineraryId);
  if (error) throw new Error(`Failed to update status: ${error.message}`);

  await writeAudit(supabase, {
    userId: actingUserId,
    action: 'detailed_itinerary.status_changed',
    entityType: 'detailed_itinerary',
    entityId: detailedItineraryId,
    metadata: { from: currentStatus, to: nextStatus },
  });
}
