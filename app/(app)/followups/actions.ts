'use server';

import { revalidatePath } from 'next/cache';
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import {
  completeFollowUpSchema,
  rescheduleFollowUpSchema,
  followUpNoteSchema,
} from '@/lib/validation/followup';
import * as followupsService from '@/lib/services/followups';
import { updateQuotationPipelineStage, type PipelineStage } from '@/lib/services/pipeline';

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function completeFollowUpAction(input: {
  followUpId: string;
  outcome: string;
  method: string;
  notes?: string;
}): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = completeFollowUpSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid follow-up details.' };
  }

  const supabase = await createSupabaseServerClient();
  try {
    await followupsService.completeFollowUp(
      supabase,
      parsed.data.followUpId,
      { outcome: parsed.data.outcome, method: parsed.data.method, notes: parsed.data.notes },
      user.id
    );
    revalidatePath('/followups');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to complete follow-up.' };
  }
}

export async function rescheduleFollowUpAction(input: {
  followUpId: string;
  newDueDate: string;
}): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = rescheduleFollowUpSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Pick a valid date.' };
  }

  const supabase = await createSupabaseServerClient();
  try {
    await followupsService.rescheduleFollowUp(supabase, parsed.data.followUpId, parsed.data.newDueDate, user.id);
    revalidatePath('/followups');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to reschedule.' };
  }
}

export async function addFollowUpNoteAction(input: { followUpId: string; note: string }): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = followUpNoteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Note cannot be empty.' };
  }

  const supabase = await createSupabaseServerClient();
  try {
    await followupsService.addFollowUpNote(supabase, parsed.data.followUpId, parsed.data.note, user.id);
    revalidatePath('/followups');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to add note.' };
  }
}

/** "Skip" — this specific follow-up isn't happening, but the sequence continues; the next one gets scheduled automatically. */
export async function skipFollowUpAction(followUpId: string): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  try {
    await followupsService.skipFollowUp(supabase, followUpId, user.id);
    revalidatePath('/followups');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to skip follow-up.' };
  }
}

/** "Stop" — halts the sequence entirely; no further follow-up gets scheduled for this quotation. */
export async function stopFollowUpAction(followUpId: string): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  try {
    await followupsService.stopFollowUp(supabase, followUpId, user.id);
    revalidatePath('/followups');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to stop follow-up.' };
  }
}

/** Called when a card is dragged to a new column on the Kanban board. */
export async function updatePipelineStageAction(quotationId: string, newStage: PipelineStage): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  try {
    await updateQuotationPipelineStage(supabase, quotationId, newStage, user.id);
    revalidatePath('/followups');
    revalidatePath('/dashboard');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to move card.' };
  }
}
