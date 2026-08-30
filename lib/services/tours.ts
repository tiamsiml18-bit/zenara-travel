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
  };
}

export interface TourListFilters {
  q?: string;
  includeInactive?: boolean;
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
    .select('id, name, destination, is_active, price_senior, price_adult, price_child, price_infant, price_pwd', { count: 'exact' })
    .is('deleted_at', null)
    .order('name')
    .range(from, to);

  if (!filters.includeInactive) query = query.eq('is_active', true);
  if (filters.q) query = query.or(`name.ilike.%${filters.q}%,destination.ilike.%${filters.q}%`);

  const { data, error, count } = await query;
  if (error) throw new Error(`Failed to load tours: ${error.message}`);
  return { tours: data ?? [], total: count ?? 0, page, pageSize };
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
       price_senior, price_adult, price_child, price_infant, price_pwd, group_cost`
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
      is_active: true,
      created_by: actingUserId,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`Failed to duplicate tour: ${error?.message}`);

  await writeAudit(supabase, { userId: actingUserId, action: 'tour.duplicated', entityType: 'tour', entityId: data.id, metadata: { copiedFrom: tourId } });
  return data.id as string;
}
