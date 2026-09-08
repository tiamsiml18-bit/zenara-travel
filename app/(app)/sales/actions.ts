'use server';

import { revalidatePath } from 'next/cache';
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import * as salesService from '@/lib/services/sales';
import { salesCostUpdateSchema, type SalesCostUpdateInput } from '@/lib/validation/sales';

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

export async function updateSalesCostsAction(input: SalesCostUpdateInput): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = salesCostUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid cost values.' };
  }

  const supabase = await createSupabaseServerClient();
  try {
    const { bookingId, ...updates } = parsed.data;
    await salesService.updateSalesCosts(supabase, bookingId, updates, user.id);
    revalidatePath('/sales');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to save sales costs.' };
  }
}
