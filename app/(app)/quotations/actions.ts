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
    return { ok: true, quotationId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to revise quotation.' };
  }
}

export async function sendQuotationAction(quotationId: string) {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  await quotationsService.sendQuotation(supabase, quotationId, user.id);
  revalidatePath(`/quotations/${quotationId}`);
  revalidatePath('/followups');
}

export async function duplicateQuotationAction(quotationId: string): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  try {
    const result = await quotationsService.duplicateQuotation(supabase, quotationId, user.id);
    revalidatePath('/quotations');
    return { ok: true, quotationId: result.quotationId, quotationNumber: result.quotationNumber };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to duplicate quotation.' };
  }
}

export async function redirectToQuotation(quotationId: string) {
  redirect(`/quotations/${quotationId}`);
}

export async function getPackageDetailsAction(packageId: string) {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  return getPackageForQuotation(supabase, packageId);
}
