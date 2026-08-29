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
       num_adults, num_children, hotel_name, num_bedrooms, price_per_person, total_price, currency`
    )
    .eq('id', quotation.current_version_id)
    .single();
  if (vError || !version) throw new Error('Quotation has no version to render.');

  const [{ data: itinerary }, { data: inclusions }, { data: exclusions }] = await Promise.all([
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
  ]);

  const { data: agency } = await supabase.from('agency_settings').select('*').limit(1).single();

  return {
    quotationNumber: quotation.quotation_number as string,
    versionLabel: version.version_label as string,
    client: { name: version.client_name_snapshot as string },
    agent: unwrapToOne(quotation.agent),
    trip: {
      destination: version.destination as string,
      travelStartDate: version.travel_start_date as string,
      travelEndDate: version.travel_end_date as string,
      numAdults: version.num_adults as number,
      numChildren: version.num_children as number,
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
