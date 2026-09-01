'use server';

import { revalidatePath } from 'next/cache';
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';
import { tourSchema, type TourFormInput } from '@/lib/validation/tour';
import * as toursService from '@/lib/services/tours';

export type ActionResult = { ok: true; tourId: string } | { ok: false; error: string };

export async function createTourAction(input: TourFormInput): Promise<ActionResult> {
  const user = await requireRole('admin', 'manager');
  const parsed = tourSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid tour details.' };
  }

  const supabase = await createSupabaseServerClient();
  // The database write is the ONLY thing that determines success or
  // failure here. A tour that's already safely in the database must never
  // be reported as a failure just because a secondary step below (cache
  // revalidation) hiccups -- that mismatch is exactly what previously let
  // an agent see an error, click Save again, and create a real duplicate.
  let tourId: string;
  try {
    tourId = await toursService.createTour(supabase, parsed.data, user.id);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to create tour.' };
  }

  try {
    revalidatePath('/tours');
  } catch (err) {
    console.error('[tours] revalidatePath failed after a successful create — tour was still saved', err);
  }
  return { ok: true, tourId };
}

export async function updateTourAction(tourId: string, input: TourFormInput): Promise<ActionResult> {
  const user = await requireRole('admin', 'manager');
  const parsed = tourSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid tour details.' };
  }

  const supabase = await createSupabaseServerClient();
  try {
    await toursService.updateTour(supabase, tourId, parsed.data, user.id);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update tour.' };
  }

  try {
    revalidatePath('/tours');
    revalidatePath(`/tours/${tourId}`);
  } catch (err) {
    console.error('[tours] revalidatePath failed after a successful update — tour was still saved', err);
  }
  return { ok: true, tourId };
}

export async function setTourActiveAction(tourId: string, isActive: boolean) {
  const user = await requireRole('admin', 'manager');
  const supabase = await createSupabaseServerClient();
  await toursService.setTourActive(supabase, tourId, isActive, user.id);
  revalidatePath('/tours');
}

export async function duplicateTourAction(tourId: string): Promise<ActionResult> {
  const user = await requireRole('admin', 'manager');
  const supabase = await createSupabaseServerClient();
  try {
    const newId = await toursService.duplicateTour(supabase, tourId, user.id);
    revalidatePath('/tours');
    return { ok: true, tourId: newId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to duplicate tour.' };
  }
}
