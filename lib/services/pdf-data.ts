import type { SupabaseClient } from '@supabase/supabase-js';
import { unwrapToOne } from '@/lib/utils/unwrap-embed';

/**
 * Client-safe quotation data for PDF rendering.
 *
 * SECURITY NOTE: this function's select list is hand-written and intentionally
 * never joins `quotation_pricing_internal`. There is no code path in this file
 * that can accidentally pull supplier cost, markup, or profit into a PDF —
 * the only price fields available here are `price_per_person` and
 * `total_price` on `quotation_versions`, which are the client-facing selling
 * price by design (see database/migrations/0001_init.sql).
 */
export async function getQuotationPdfData(supabase: SupabaseClient, quotationId: string) {
  const { data: quotation, error } = await supabase
    .from('quotations')
    .select(
      `id, quotation_number, status, current_version_id,
       client:clients ( full_name ),
       agent:users!quotations_assigned_agent_id_fkey ( full_name, email, phone )`
    )
    .eq('id', quotationId)
    .single();
  if (error || !quotation) throw new Error('Quotation not found.');

  const { data: version, error: vError } = await supabase
    .from('quotation_versions')
    .select(
      `id, version_label, client_name_snapshot, destination, travel_start_date, travel_end_date,
       num_adults, num_children, hotel_name, num_bedrooms, price_per_person, total_price, currency,
       consultant_name_snapshot, num_seniors, num_infants`
    )
    .eq('id', quotation.current_version_id)
    .single();
  if (vError || !version) throw new Error('Quotation has no version to render.');

  const [{ data: itinerary }, { data: inclusions }, { data: exclusions }, { data: fees }] = await Promise.all([
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

  return {
    quotationNumber: quotation.quotation_number as string,
    versionLabel: version.version_label as string,
    client: { name: version.client_name_snapshot as string },
    agent: displayAgent,
    trip: {
      destination: version.destination as string,
      travelStartDate: version.travel_start_date as string,
      travelEndDate: version.travel_end_date as string,
      numAdults: version.num_adults as number,
      numChildren: version.num_children as number,
      numSeniors: (version.num_seniors as number) ?? 0,
      numInfants: (version.num_infants as number) ?? 0,
      hotelName: version.hotel_name as string | null,
      numBedrooms: version.num_bedrooms as number | null,
    },
    pricing: {
      pricePerPerson: version.price_per_person as number | null,
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
