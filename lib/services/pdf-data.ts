import type { SupabaseClient } from '@supabase/supabase-js';
import { unwrapToOne } from '@/lib/utils/unwrap-embed';
import { buildGuestLineItems, type GuestCounts, type GuestRates } from '@/lib/utils/guest-pricing';

/** e.g. "BORACAY 4D3N PACKAGE" from real start/end dates — the conventional way travel agencies name a trip, computed rather than invented. */
function buildPackageTitle(destination: string, startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  const nights = Math.max(0, days - 1);
  return `${destination.toUpperCase()} ${days}D${nights}N PACKAGE`;
}

/**
 * Client-safe quotation data for PDF rendering.
 *
 * SECURITY NOTE: this function's select list is hand-written and intentionally
 * never joins `quotation_pricing_internal` or `quotation_guest_pricing_internal`
 * — only `quotation_guest_pricing` (the client-facing rate table) is read here.
 * There is no code path in this file that can accidentally pull supplier cost,
 * markup, or profit into a PDF.
 */
export async function getQuotationPdfData(supabase: SupabaseClient, quotationId: string) {
  const { data: quotation, error } = await supabase
    .from('quotations')
    .select(
      `id, quotation_number, status, current_version_id,
       client:clients ( full_name ),
       agent:users!quotations_assigned_agent_id_fkey ( full_name, email, phone ),
       package:packages ( name )`
    )
    .is('deleted_at', null)
    .eq('id', quotationId)
    .single();
  if (error || !quotation) throw new Error('Quotation not found.');

  const { data: version, error: vError } = await supabase
    .from('quotation_versions')
    .select(
      `id, version_label, client_name_snapshot, destination, package_type, travel_start_date, travel_end_date, valid_until,
       num_adults, num_children, hotel_name, num_bedrooms, price_per_person, total_price, currency,
       consultant_name_snapshot, num_seniors, num_infants, num_pwd`
    )
    .eq('id', quotation.current_version_id)
    .single();
  if (vError || !version) throw new Error('Quotation has no version to render.');

  const [
    { data: itinerary },
    { data: inclusions },
    { data: exclusions },
    { data: fees },
    { data: guestPricing },
    { data: flightSegments },
    { data: agency },
  ] = await Promise.all([
      supabase
        .from('quotation_itinerary_days')
        .select('day_number, title, description, activities')
        .eq('quotation_version_id', version.id)
        .order('day_number'),
      supabase
        .from('quotation_inclusions')
        .select('item')
        .eq('quotation_version_id', version.id)
        .order('sort_order'),
      supabase
        .from('quotation_exclusions')
        .select('item')
        .eq('quotation_version_id', version.id)
        .order('sort_order'),
      // Client-facing by design (unlike quotation_pricing_internal above) —
      // these are meant to show up on the PDF as their own labeled section.
      supabase
        .from('quotation_fees')
        .select('label, amount')
        .eq('quotation_version_id', version.id)
        .order('sort_order'),
      // Client-facing rate per guest type — quotation_guest_pricing only,
      // never its _internal counterpart (supplier cost).
      supabase.from('quotation_guest_pricing').select('guest_type, price_per_person').eq('quotation_version_id', version.id),
      supabase
        .from('quotation_flight_segments')
        .select('airline, flight_number, departure_time, arrival_time, route')
        .eq('quotation_version_id', version.id)
        .order('sort_order'),
      // Doesn't depend on quotation/version at all (just the one agency-wide
      // settings row) — previously fetched in a separate sequential request
      // after this batch; folded in here since nothing here depends on it
      // either, saving one network round trip per PDF render. Same query,
      // same data, no change to PDF output.
      supabase.from('agency_settings').select('*').limit(1).single(),
    ]);

  // Prefer the named consultant selected on the quotation (see
  // agency_consultants) — the agency shares one login across three people,
  // so the authenticated account's own name is a poor stand-in for "who's
  // actually handling this trip." Falls back to the logged-in account's
  // name for quotations created before this existed.
  const assignedAgent = unwrapToOne(quotation.agent);
  const displayAgent = {
    full_name: (version.consultant_name_snapshot as string | null) ?? assignedAgent?.full_name ?? null,
    email: assignedAgent?.email ?? null,
    phone: assignedAgent?.phone ?? null,
  };

  const counts: GuestCounts = {
    senior: (version.num_seniors as number) ?? 0,
    adult: version.num_adults as number,
    child: version.num_children as number,
    infant: (version.num_infants as number) ?? 0,
    pwd: (version.num_pwd as number) ?? 0,
  };
  const rates: GuestRates = {};
  for (const g of guestPricing ?? []) rates[g.guest_type as keyof GuestRates] = Number(g.price_per_person);

  // Quotations created before the per-guest-type pricing feature existed
  // have real guest counts but zero rows in quotation_guest_pricing — for
  // those, showing "2 guests × PHP 0" would be actively wrong (the real
  // total, still correctly stored in total_price below, just was never
  // split out by category). Rather than guess at a per-category split for
  // data that was never entered that way, the breakdown is simply omitted
  // and only the correct total shows — never a fabricated zero.
  const guestLines = (guestPricing ?? []).length > 0 ? buildGuestLineItems(counts, rates) : [];

  // "Tour Package" title — a saved package's real name when this quotation
  // was built from one; otherwise derived from the trip's own actual dates
  // and destination (e.g. "BORACAY 4D3N PACKAGE"), never a placeholder.
  // This is a straightforward computation from real data, not an invented
  // value — the same convention travel agencies already use when naming
  // custom packages by hand.
  const linkedPackage = unwrapToOne(quotation.package) as { name: string } | null;
  const packageTitle = linkedPackage?.name ?? buildPackageTitle(version.destination as string, version.travel_start_date as string, version.travel_end_date as string);

  return {
    quotationNumber: quotation.quotation_number as string,
    versionLabel: version.version_label as string,
    client: { name: version.client_name_snapshot as string },
    agent: displayAgent,
    packageTitle,
    validUntil: (version.valid_until as string) ?? null,
    trip: {
      destination: version.destination as string,
      packageType: version.package_type as 'all_in' | 'land_arrangement',
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
    pricing: {
      guestLines,
      totalPrice: version.total_price as number,
      currency: (version.currency as string) ?? 'PHP',
    },
    itinerary: (itinerary ?? []).map((d) => ({
      dayNumber: d.day_number as number,
      title: d.title as string,
      description: d.description as string | null,
      activities: (d.activities as string[]) ?? [],
    })),
    inclusions: (inclusions ?? []).map((i) => i.item as string),
    exclusions: (exclusions ?? []).map((e) => e.item as string),
    // Only ever what the agent actually typed into Flight Details — never
    // filled in or guessed. Empty array when nothing was entered, which
    // the PDF renders as "no Flight Schedule section at all" (never a
    // heading with blank space).
    flightSegments: (flightSegments ?? []).map((f) => ({
      airline: f.airline as string,
      flightNumber: f.flight_number as string,
      departureTime: f.departure_time as string,
      arrivalTime: f.arrival_time as string,
      route: f.route as string,
    })),
    fees: (fees ?? []).map((f) => ({ label: f.label as string, amount: Number(f.amount) })),
    agency: {
      name: agency?.agency_name ?? 'Zenara Travel and Tours',
      logoUrl: agency?.logo_url ?? null,
      phone: agency?.phone ?? null,
      email: agency?.email ?? null,
      facebook: agency?.facebook ?? null,
      instagram: agency?.instagram ?? null,
      whatsapp: agency?.whatsapp ?? null,
      website: agency?.website ?? null,
      footer: agency?.quotation_footer ?? null,
      termsAndConditions:
        agency?.terms_and_conditions ??
        'Rates are subject to availability and may change without prior notice until booking is confirmed.',
      paymentInstructions: agency?.payment_instructions ?? null,
    },
  };
}

export type QuotationPdfData = Awaited<ReturnType<typeof getQuotationPdfData>>;

// ============================================================================
// Detailed Itinerary PDF data — a completely separate document from the
// quotation PDF above. Shares only the agency_settings lookup (logo,
// contact info, footer defaults); everything else is read through
// getInheritedQuotationData() (bookings.quotation_version_id, never
// quotations.current_version_id) plus the itinerary's own operational
// tables. Nothing here is ever reused by, or shared with, the quotation
// PDF's render path.
// ============================================================================
import { getInheritedQuotationData } from './detailed-itineraries';

export async function getDetailedItineraryPdfData(supabase: SupabaseClient, detailedItineraryId: string) {
  const { data: parent, error } = await supabase
    .from('detailed_itineraries')
    .select(
      `id, booking_id, status, sent_at,
       airport_instructions, contact_instructions, important_reminders, guide_instructions,
       hotel_address, hotel_phone, hotel_checkin_info, hotel_confirmation_number, hotel_booking_number, hotel_pin,
       custom_notes`
    )
    .eq('id', detailedItineraryId)
    .single();
  if (error || !parent) throw new Error('Detailed itinerary not found.');

  const [inherited, { data: flightDetails }, { data: dailyDetails }, { data: transfers }, { data: agency }] = await Promise.all([
    getInheritedQuotationData(supabase, parent.booking_id as string),
    supabase
      .from('detailed_itinerary_flight_details')
      .select('quotation_flight_segment_id, booking_reference, terminal, special_instructions')
      .eq('detailed_itinerary_id', detailedItineraryId),
    supabase
      .from('detailed_itinerary_daily_details')
      .select('quotation_itinerary_day_id, pickup_time, meeting_point, meals, free_time, operational_notes')
      .eq('detailed_itinerary_id', detailedItineraryId),
    supabase
      .from('detailed_itinerary_transfers')
      .select('pickup_location, pickup_time, driver_guide_name, contact_number, meeting_point, vehicle_info')
      .eq('detailed_itinerary_id', detailedItineraryId)
      .order('sort_order'),
    supabase.from('agency_settings').select('*').limit(1).single(),
  ]);

  const flightDetailBySegmentId = new Map((flightDetails ?? []).map((f) => [f.quotation_flight_segment_id as string, f]));
  const dailyDetailByDayId = new Map((dailyDetails ?? []).map((d) => [d.quotation_itinerary_day_id as string, d]));

  return {
    status: parent.status as string,
    sentAt: parent.sent_at as string | null,
    bookingNumber: inherited.booking.bookingNumber,
    quotationNumber: inherited.quotationNumber,
    packageName: inherited.packageName,
    client: inherited.client,
    consultant: inherited.consultant,
    trip: inherited.trip,
    // Day-by-day, each inherited quotation day merged with its optional
    // operational overlay — never duplicated, read live and joined here.
    itinerary: inherited.itinerary.map((day) => {
      const detail = dailyDetailByDayId.get(day.id);
      return {
        dayNumber: day.dayNumber,
        dayDate: day.dayDate,
        title: day.title,
        description: day.description,
        activities: day.activities,
        pickupTime: (detail?.pickup_time as string | null) ?? null,
        meetingPoint: (detail?.meeting_point as string | null) ?? null,
        meals: (detail?.meals as string | null) ?? null,
        freeTime: (detail?.free_time as string | null) ?? null,
        operationalNotes: (detail?.operational_notes as string | null) ?? null,
      };
    }),
    flightSegments: inherited.flightSegments.map((seg) => {
      const detail = flightDetailBySegmentId.get(seg.id);
      return {
        airline: seg.airline,
        flightNumber: seg.flightNumber,
        departureTime: seg.departureTime,
        arrivalTime: seg.arrivalTime,
        route: seg.route,
        bookingReference: (detail?.booking_reference as string | null) ?? null,
        terminal: (detail?.terminal as string | null) ?? null,
        specialInstructions: (detail?.special_instructions as string | null) ?? null,
      };
    }),
    hotel: {
      name: inherited.trip.hotelName,
      address: parent.hotel_address as string | null,
      phone: parent.hotel_phone as string | null,
      checkinInfo: parent.hotel_checkin_info as string | null,
      confirmationNumber: parent.hotel_confirmation_number as string | null,
      bookingNumber: parent.hotel_booking_number as string | null,
      pin: parent.hotel_pin as string | null,
    },
    travelReminders: {
      airportInstructions: parent.airport_instructions as string | null,
      contactInstructions: parent.contact_instructions as string | null,
      importantReminders: parent.important_reminders as string | null,
      guideInstructions: parent.guide_instructions as string | null,
    },
    transfers: (transfers ?? []).map((t) => ({
      pickupLocation: t.pickup_location as string | null,
      pickupTime: t.pickup_time as string | null,
      driverGuideName: t.driver_guide_name as string | null,
      contactNumber: t.contact_number as string | null,
      meetingPoint: t.meeting_point as string | null,
      vehicleInfo: t.vehicle_info as string | null,
    })),
    customNotes: parent.custom_notes as string | null,
    agency: {
      name: agency?.agency_name ?? 'Zenara Travel and Tours',
      logoUrl: agency?.logo_url ?? null,
      phone: agency?.phone ?? null,
      email: agency?.email ?? null,
      whatsapp: agency?.whatsapp ?? null,
      website: agency?.website ?? null,
    },
  };
}

export type DetailedItineraryPdfData = Awaited<ReturnType<typeof getDetailedItineraryPdfData>>;
