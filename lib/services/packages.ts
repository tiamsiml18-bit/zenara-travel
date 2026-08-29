import type { SupabaseClient } from '@supabase/supabase-js';
import type { PackageFormInput } from '@/lib/validation/package';
import { writeAudit } from './audit';

export interface PackageListFilters {
  search?: string;
  includeInactive?: boolean;
  page?: number;
  pageSize?: number;
}

/** Admin/manager package library listing — includes inactive templates unless filtered out. */
export async function listPackages(supabase: SupabaseClient, filters: PackageListFilters = {}) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('packages')
    .select('id, name, destination, num_days, num_nights, is_active, updated_at', { count: 'exact' })
    .is('deleted_at', null)
    .order('name')
    .range(from, to);

  if (!filters.includeInactive) query = query.eq('is_active', true);
  if (filters.search) query = query.or(`name.ilike.%${filters.search}%,destination.ilike.%${filters.search}%`);

  const { data, error, count } = await query;
  if (error) throw new Error(`Failed to load packages: ${error.message}`);
  return { packages: data ?? [], total: count ?? 0, page, pageSize };
}

export async function listActivePackages(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('packages')
    .select('id, name, destination, num_days, num_nights')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Full editable payload for the package edit screen (distinct from getPackageForQuotation's flattened shape). */
export async function getPackageById(supabase: SupabaseClient, packageId: string) {
  const [{ data: pkg, error: pkgError }, { data: itinerary }, { data: inclusions }, { data: exclusions }] =
    await Promise.all([
      supabase.from('packages').select('*').eq('id', packageId).is('deleted_at', null).single(),
      supabase
        .from('package_itineraries')
        .select('id, day_number, title, description, activities')
        .eq('package_id', packageId)
        .order('day_number'),
      supabase.from('package_inclusions').select('id, item').eq('package_id', packageId).order('sort_order'),
      supabase.from('package_exclusions').select('id, item').eq('package_id', packageId).order('sort_order'),
    ]);

  if (pkgError || !pkg) throw new Error('Package not found.');

  return {
    package: pkg,
    itinerary: (itinerary ?? []).map((d) => ({
      dayNumber: d.day_number,
      title: d.title,
      description: d.description ?? '',
      activities: d.activities ?? [],
      dayDate: '',
    })),
    inclusions: (inclusions ?? []).map((i) => i.item),
    exclusions: (exclusions ?? []).map((e) => e.item),
  };
}

/**
 * Replaces a package's itinerary/inclusions/exclusions wholesale (delete + reinsert).
 * Safe because packages are templates, not historical records — unlike
 * quotation_versions, there is no immutability requirement here. Existing
 * quotations that were created FROM this package already hold their own
 * copied snapshot and are entirely unaffected by this edit.
 */
async function replacePackageChildren(supabase: SupabaseClient, packageId: string, input: PackageFormInput) {
  await Promise.all([
    supabase.from('package_itineraries').delete().eq('package_id', packageId),
    supabase.from('package_inclusions').delete().eq('package_id', packageId),
    supabase.from('package_exclusions').delete().eq('package_id', packageId),
  ]);

  if (input.itinerary.length > 0) {
    const { error } = await supabase.from('package_itineraries').insert(
      input.itinerary.map((d) => ({
        package_id: packageId,
        day_number: d.dayNumber,
        title: d.title,
        description: d.description || null,
        activities: d.activities,
      }))
    );
    if (error) throw new Error(`Failed to save itinerary: ${error.message}`);
  }
  if (input.inclusions.length > 0) {
    const { error } = await supabase.from('package_inclusions').insert(
      input.inclusions.map((item, i) => ({ package_id: packageId, item, sort_order: i }))
    );
    if (error) throw new Error(`Failed to save inclusions: ${error.message}`);
  }
  if (input.exclusions.length > 0) {
    const { error } = await supabase.from('package_exclusions').insert(
      input.exclusions.map((item, i) => ({ package_id: packageId, item, sort_order: i }))
    );
    if (error) throw new Error(`Failed to save exclusions: ${error.message}`);
  }
}

export async function createPackage(supabase: SupabaseClient, input: PackageFormInput, actingUserId: string) {
  const { data, error } = await supabase
    .from('packages')
    .insert({
      name: input.name,
      destination: input.destination,
      num_days: input.numDays,
      num_nights: input.numNights,
      default_notes: input.defaultNotes || null,
      is_active: input.isActive,
      created_by: actingUserId,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`Failed to create package: ${error?.message}`);

  await replacePackageChildren(supabase, data.id, input);
  await writeAudit(supabase, { userId: actingUserId, action: 'package.created', entityType: 'package', entityId: data.id });

  return data.id as string;
}

export async function updatePackage(
  supabase: SupabaseClient,
  packageId: string,
  input: PackageFormInput,
  actingUserId: string
) {
  const { error } = await supabase
    .from('packages')
    .update({
      name: input.name,
      destination: input.destination,
      num_days: input.numDays,
      num_nights: input.numNights,
      default_notes: input.defaultNotes || null,
      is_active: input.isActive,
    })
    .eq('id', packageId);
  if (error) throw new Error(`Failed to update package: ${error.message}`);

  await replacePackageChildren(supabase, packageId, input);
  await writeAudit(supabase, { userId: actingUserId, action: 'package.updated', entityType: 'package', entityId: packageId });
}

export async function setPackageActive(
  supabase: SupabaseClient,
  packageId: string,
  isActive: boolean,
  actingUserId: string
) {
  const { error } = await supabase.from('packages').update({ is_active: isActive }).eq('id', packageId);
  if (error) throw new Error(error.message);
  await writeAudit(supabase, {
    userId: actingUserId,
    action: isActive ? 'package.activated' : 'package.deactivated',
    entityType: 'package',
    entityId: packageId,
  });
}

/**
 * Full package payload used to pre-populate a quotation draft. Selecting an
 * existing package copies this data onto the new quotation version — it does
 * NOT link back to the package in a way that later template edits would
 * retroactively change already-created quotations.
 */
export async function getPackageForQuotation(supabase: SupabaseClient, packageId: string) {
  const [{ data: pkg, error: pkgError }, { data: itinerary }, { data: inclusions }, { data: exclusions }] =
    await Promise.all([
      supabase.from('packages').select('*').eq('id', packageId).single(),
      supabase
        .from('package_itineraries')
        .select('day_number, title, description, activities')
        .eq('package_id', packageId)
        .order('day_number'),
      supabase.from('package_inclusions').select('item').eq('package_id', packageId).order('sort_order'),
      supabase.from('package_exclusions').select('item').eq('package_id', packageId).order('sort_order'),
    ]);

  if (pkgError || !pkg) throw new Error('Package not found.');

  return {
    package: pkg,
    itinerary: (itinerary ?? []).map((d) => ({
      dayNumber: d.day_number,
      title: d.title,
      description: d.description ?? '',
      activities: d.activities ?? [],
      dayDate: '',
    })),
    inclusions: (inclusions ?? []).map((i) => i.item),
    exclusions: (exclusions ?? []).map((e) => e.item),
  };
}
