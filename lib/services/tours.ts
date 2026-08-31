import type { SupabaseClient } from '@supabase/supabase-js';
import { writeAudit } from './audit';

export interface TourInput {
  name: string;
  destination?: string;
  description?: string;
  activities: string[];
  defaultInclusions: string[];
  defaultExclusions: string[];
  priceSenior?: number | null;
  priceAdult?: number | null;
  priceChild?: number | null;
  priceInfant?: number | null;
  pricePwd?: number | null;
  groupCost?: number | null;
  // Purely descriptive — e.g. "3-11 years" — shown next to the Child rate
  // so admins/agents know what this specific tour means by "Child," never
  // used to reclassify a traveler. Configurable per tour since suppliers
  // vary (see tours.age_range_* migration note).
  ageRangeSenior?: string;
  ageRangeAdult?: string;
  ageRangeChild?: string;
  ageRangeInfant?: string;
  ageRangePwd?: string;
  // Purely a categorization label for filtering the Tours library — never
  // read by pricing, Package integration, or Quotation integration.
  tourType?: 'all_in' | 'land_arrangement' | null;
}

function toDbRow(input: TourInput) {
  return {
    name: input.name,
    destination: input.destination || null,
    description: input.description || null,
    activities: input.activities,
    default_inclusions: input.defaultInclusions,
    default_exclusions: input.defaultExclusions,
    price_senior: input.priceSenior,
    price_adult: input.priceAdult,
    price_child: input.priceChild,
    price_infant: input.priceInfant,
    price_pwd: input.pricePwd,
    group_cost: input.groupCost,
    age_range_senior: input.ageRangeSenior || null,
    age_range_adult: input.ageRangeAdult || null,
    age_range_child: input.ageRangeChild || null,
    age_range_infant: input.ageRangeInfant || null,
    age_range_pwd: input.ageRangePwd || null,
    tour_type: input.tourType || null,
  };
}

export interface TourListFilters {
  q?: string;
  destination?: string;
  includeInactive?: boolean;
  tourType?: 'all_in' | 'land_arrangement';
  priceMin?: number;
  priceMax?: number;
  page?: number;
  pageSize?: number;
}

export async function listTours(supabase: SupabaseClient, filters: TourListFilters = {}) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('tours')
    .select('id, name, destination, is_active, tour_type, price_senior, price_adult, price_child, price_infant, price_pwd', { count: 'exact' })
    .is('deleted_at', null)
    .order('destination', { ascending: true, nullsFirst: false })
    .order('name')
    .range(from, to);

  if (!filters.includeInactive) query = query.eq('is_active', true);
  if (filters.destination) query = query.eq('destination', filters.destination);
  if (filters.tourType) query = query.eq('tour_type', filters.tourType);
  // Price filter is based on the tour's default Adult rate, per spec —
  // display-only categorization, never touches the actual stored rate.
  if (filters.priceMin !== undefined) query = query.gte('price_adult', filters.priceMin);
  if (filters.priceMax !== undefined) query = query.lte('price_adult', filters.priceMax);
  if (filters.q) query = query.or(`name.ilike.%${filters.q}%,destination.ilike.%${filters.q}%`);

  const { data, error, count } = await query;
  if (error) throw new Error(`Failed to load tours: ${error.message}`);
  return { tours: data ?? [], total: count ?? 0, page, pageSize };
}

/** Every distinct destination currently in use — powers the destination filter/grouping on the Tours page and the destination-first tour picker in itineraries. */
export async function listTourDestinations(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase.from('tours').select('destination').is('deleted_at', null).not('destination', 'is', null);
  if (error) throw new Error(`Failed to load tour destinations: ${error.message}`);
  return Array.from(new Set((data ?? []).map((r) => r.destination as string))).sort();
}

/**
 * Every field the "Select Tour" dropdown needs to auto-populate an
 * itinerary day and pre-fill guest pricing — one query, no follow-up
 * fetches per selection.
 */
export async function listToursForPicker(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('tours')
    .select(
      `id, name, destination, description, activities, default_inclusions, default_exclusions,
       price_senior, price_adult, price_child, price_infant, price_pwd, group_cost,
       age_range_senior, age_range_adult, age_range_child, age_range_infant, age_range_pwd`
    )
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name');
  if (error) throw new Error(`Failed to load tours: ${error.message}`);
  return data ?? [];
}

export async function getTourById(supabase: SupabaseClient, tourId: string) {
  const { data, error } = await supabase.from('tours').select('*').eq('id', tourId).single();
  if (error || !data) throw new Error('Tour not found.');
  return data;
}

export async function createTour(supabase: SupabaseClient, input: TourInput, actingUserId: string) {
  const { data, error } = await supabase
    .from('tours')
    .insert({ ...toDbRow(input), created_by: actingUserId })
    .select('id')
    .single();
  if (error || !data) throw new Error(`Failed to create tour: ${error?.message}`);

  await writeAudit(supabase, { userId: actingUserId, action: 'tour.created', entityType: 'tour', entityId: data.id });
  return data.id as string;
}

export async function updateTour(supabase: SupabaseClient, tourId: string, input: TourInput, actingUserId: string) {
  const { error } = await supabase.from('tours').update(toDbRow(input)).eq('id', tourId);
  if (error) throw new Error(`Failed to update tour: ${error.message}`);

  await writeAudit(supabase, { userId: actingUserId, action: 'tour.updated', entityType: 'tour', entityId: tourId });
}

/** Same soft-archive pattern as quotations/clients — never a permanent delete, so a tour already used in a quotation is never broken. */
export async function setTourActive(supabase: SupabaseClient, tourId: string, isActive: boolean, actingUserId: string) {
  const { error } = await supabase.from('tours').update({ is_active: isActive }).eq('id', tourId);
  if (error) throw new Error(`Failed to update tour: ${error.message}`);

  await writeAudit(supabase, {
    userId: actingUserId,
    action: isActive ? 'tour.activated' : 'tour.archived',
    entityType: 'tour',
    entityId: tourId,
  });
}

export async function duplicateTour(supabase: SupabaseClient, tourId: string, actingUserId: string) {
  const source = await getTourById(supabase, tourId);
  const { data, error } = await supabase
    .from('tours')
    .insert({
      name: `${source.name} (Copy)`,
      destination: source.destination,
      description: source.description,
      activities: source.activities,
      default_inclusions: source.default_inclusions,
      default_exclusions: source.default_exclusions,
      price_senior: source.price_senior,
      price_adult: source.price_adult,
      price_child: source.price_child,
      price_infant: source.price_infant,
      price_pwd: source.price_pwd,
      group_cost: source.group_cost,
      age_range_senior: source.age_range_senior,
      age_range_adult: source.age_range_adult,
      age_range_child: source.age_range_child,
      age_range_infant: source.age_range_infant,
      age_range_pwd: source.age_range_pwd,
      tour_type: source.tour_type,
      is_active: true,
      created_by: actingUserId,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`Failed to duplicate tour: ${error?.message}`);

  await writeAudit(supabase, { userId: actingUserId, action: 'tour.duplicated', entityType: 'tour', entityId: data.id, metadata: { copiedFrom: tourId } });
  return data.id as string;
}
