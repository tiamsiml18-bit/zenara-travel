'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import { quotationDraftSchema, type QuotationDraftInput } from '@/lib/validation/quotation';
import * as quotationsService from '@/lib/services/quotations';
import { getPackageForQuotation } from '@/lib/services/packages';

export type ActionResult =
  | { ok: true; quotationId: string; quotationNumber?: string }
  | { ok: false; error: string };

export async function createQuotationDraftAction(input: QuotationDraftInput): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = quotationDraftSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid quotation data.' };
  }

  const supabase = await createSupabaseServerClient();
  try {
    const { quotationId, quotationNumber } = await quotationsService.createDraftQuotation(
      supabase,
      parsed.data,
      user.id
    );
    revalidatePath('/quotations');
    revalidatePath(`/clients/${parsed.data.clientId}`);
    revalidatePath('/dashboard');
    return { ok: true, quotationId, quotationNumber };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to create quotation.' };
  }
}

export async function reviseQuotationAction(
  quotationId: string,
  input: QuotationDraftInput
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = quotationDraftSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid quotation data.' };
  }

  const supabase = await createSupabaseServerClient();
  try {
    await quotationsService.reviseQuotation(supabase, quotationId, parsed.data, user.id);
    revalidatePath(`/quotations/${quotationId}`);
    revalidatePath('/quotations');
    revalidatePath('/dashboard');
    return { ok: true, quotationId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to revise quotation.' };
  }
}

/** Draft-only in-place edit — see updateDraftQuotation() for why this never bumps a revision number. */
export async function updateDraftQuotationAction(
  quotationId: string,
  input: QuotationDraftInput
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = quotationDraftSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid quotation data.' };
  }

  const supabase = await createSupabaseServerClient();
  try {
    await quotationsService.updateDraftQuotation(supabase, quotationId, parsed.data, user.id);
    revalidatePath(`/quotations/${quotationId}`);
    revalidatePath('/quotations');
    revalidatePath('/dashboard');
    return { ok: true, quotationId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to save changes.' };
  }
}

export async function sendQuotationAction(quotationId: string) {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { clientId } = await quotationsService.sendQuotation(supabase, quotationId, user.id);
  revalidatePath(`/quotations/${quotationId}`);
  revalidatePath('/quotations');
  revalidatePath('/followups');
  revalidatePath(`/clients/${clientId}`);
  revalidatePath('/clients');
  revalidatePath('/dashboard');
  revalidatePath('/reports');
}

export async function duplicateQuotationAction(quotationId: string): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  try {
    const result = await quotationsService.duplicateQuotation(supabase, quotationId, user.id);
    revalidatePath('/quotations');
    revalidatePath('/dashboard');
    return { ok: true, quotationId: result.quotationId, quotationNumber: result.quotationNumber };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to duplicate quotation.' };
  }
}

export async function redirectToQuotation(quotationId: string) {
  redirect(`/quotations/${quotationId}`);
}

/** Archiving is gated by a confirmation dialog client-side; this action just executes. */
export async function archiveQuotationAction(quotationId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  try {
    await quotationsService.archiveQuotation(supabase, quotationId, user.id);
    revalidatePath('/quotations');
    revalidatePath(`/quotations/${quotationId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to archive quotation.' };
  }
}

/** Delete Selected — moves one or more quotations to the Recycle Bin. Never a permanent delete; existing data and every child record are left completely untouched, only deleted_at/deleted_by change. */
export async function deleteQuotationsAction(quotationIds: string[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  try {
    await quotationsService.softDeleteQuotations(supabase, quotationIds, user.id);
    revalidatePath('/quotations');
    revalidatePath('/quotations/deleted');
    revalidatePath('/dashboard');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to delete quotation(s).' };
  }
}

export async function restoreQuotationAction(quotationId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  try {
    await quotationsService.restoreQuotation(supabase, quotationId, user.id);
    revalidatePath('/quotations');
    revalidatePath('/quotations/deleted');
    revalidatePath('/dashboard');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to restore quotation.' };
  }
}

export async function getPackageDetailsAction(packageId: string) {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  return getPackageForQuotation(supabase, packageId);
}
