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
    .eq('id', quotationId)
    .single();
  if (error || !quotation) throw new Error('Quotation not found.');

  const { data: version, error: vError } = await supabase
    .from('quotation_versions')
    .select(
      `id, version_label, client_name_snapshot, destination, travel_start_date, travel_end_date, valid_until,
       num_adults, num_children, hotel_name, num_bedrooms, price_per_person, total_price, currency,
       consultant_name_snapshot, num_seniors, num_infants, num_pwd`
    )
    .eq('id', quotation.current_version_id)
    .single();
  if (vError || !version) throw new Error('Quotation has no version to render.');

  const [{ data: itinerary }, { data: inclusions }, { data: exclusions }, { data: fees }, { data: guestPricing }] =
    await Promise.all([
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
    ]);

  const { data: agency } = await supabase.from('agency_settings').select('*').limit(1).single();

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
