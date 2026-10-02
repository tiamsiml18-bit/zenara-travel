'use server';

import { revalidatePath } from 'next/cache';
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import {
  operationalFieldsSchema,
  statusTransitionSchema,
  type OperationalFieldsInput,
  type FlightDetailInput,
  type DailyDetailInput,
  type TransferInput,
  type DetailedItineraryStatus,
} from '@/lib/validation/detailed-itinerary';
import * as detailedItinerariesService from '@/lib/services/detailed-itineraries';

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

/**
 * Saves everything the agent edits on the Detailed Itinerary detail page
 * in one action: the flat operational fields plus the three child-row
 * lists (flight details, daily details, transfers). Mirrors how the
 * Quotation Builder saves its own several child tables together from one
 * "Save" click — a familiar pattern in this app, not a new one.
 */
export async function saveDetailedItineraryAction(input: {
  operational: OperationalFieldsInput;
  flightDetails: FlightDetailInput[];
  dailyDetails: DailyDetailInput[];
  transfers: TransferInput[];
}): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = operationalFieldsSchema.safeParse(input.operational);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }

  const supabase = await createSupabaseServerClient();
  try {
    await detailedItinerariesService.updateOperationalFields(supabase, parsed.data, user.id);
    await detailedItinerariesService.replaceFlightDetails(supabase, parsed.data.detailedItineraryId, input.flightDetails, user.id);
    await detailedItinerariesService.replaceDailyDetails(supabase, parsed.data.detailedItineraryId, input.dailyDetails, user.id);
    await detailedItinerariesService.replaceTransfers(supabase, parsed.data.detailedItineraryId, input.transfers, user.id);
    revalidatePath(`/detailed-itineraries/${parsed.data.detailedItineraryId}`);
    revalidatePath('/detailed-itineraries');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to save the detailed itinerary.' };
  }
}

export async function transitionDetailedItineraryStatusAction(input: {
  detailedItineraryId: string;
  nextStatus: DetailedItineraryStatus;
}): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = statusTransitionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid status transition.' };

  const supabase = await createSupabaseServerClient();
  try {
    await detailedItinerariesService.transitionStatus(supabase, parsed.data.detailedItineraryId, parsed.data.nextStatus, user.id);
    revalidatePath(`/detailed-itineraries/${parsed.data.detailedItineraryId}`);
    revalidatePath('/detailed-itineraries');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update status.' };
  }
}

/**
 * Manual "create now" escape hatch for an agent who needs a Detailed
 * Itinerary before the 14-day cron would normally create one — the cron
 * job and this action both go through the same idempotent
 * createDraftForBooking(), so there is never a risk of ending up with two.
 */
export async function createDetailedItineraryForBookingAction(bookingId: string): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  try {
    const { id } = await detailedItinerariesService.createDraftForBooking(supabase, bookingId, user.id);
    revalidatePath('/detailed-itineraries');
    return { ok: true, data: { id } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to create detailed itinerary.' };
  }
}
