'use server';

import { revalidatePath } from 'next/cache';
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import * as salesService from '@/lib/services/sales';
import * as historicalSalesService from '@/lib/services/historical-sales';
import { salesCostUpdateSchema, type SalesCostUpdateInput } from '@/lib/validation/sales';
import { historicalSaleSchema, type HistoricalSaleInput } from '@/lib/validation/historical-sales';
import { validateHistoricalMappedRow, type HistoricalMappedRow, type NormalizedHistoricalRow } from '@/lib/validation/historical-sales-import';

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

// ============================================================================
// Historical Sales — manual add/edit and bulk import. Deliberately never
// touches quotations, clients, bookings, or payments; see
// lib/services/historical-sales.ts.
// ============================================================================

export async function upsertHistoricalSaleAction(input: HistoricalSaleInput): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = historicalSaleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid historical sale details.' };
  }

  const supabase = await createSupabaseServerClient();
  try {
    const result = await historicalSalesService.upsertHistoricalSale(supabase, parsed.data, user.id);
    revalidatePath('/sales');
    return { ok: true, data: result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to save historical sale.' };
  }
}

export async function updateHistoricalSaleFieldAction(
  id: string,
  patch: Partial<{ airfareCost: number; hotelCost: number; transferCost: number; tourCost: number; bankCharge: number; refund: number; remarks: string }>
): Promise<ActionResult> {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  try {
    await historicalSalesService.updateHistoricalSaleField(supabase, id, patch);
    revalidatePath('/sales');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update historical sale.' };
  }
}

export async function deleteHistoricalSaleAction(id: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  try {
    await historicalSalesService.deleteHistoricalSale(supabase, id);
    revalidatePath('/sales');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to delete historical sale.' };
  }
}

/** Validates a batch of already-column-mapped rows and flags duplicates against existing Historical Sales — nothing is written yet. */
export async function validateHistoricalImportAction(
  mappedRows: HistoricalMappedRow[]
): Promise<ActionResult<{ valid: NormalizedHistoricalRow[]; invalidCount: number; duplicateRowNumbers: number[] }>> {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  try {
    const validated = mappedRows.map(validateHistoricalMappedRow);
    const valid = validated.filter((v): v is typeof v & { row: NormalizedHistoricalRow } => v.row !== null).map((v) => v.row);
    const invalidCount = validated.length - valid.length;

    const duplicateKeys = await historicalSalesService.findHistoricalDuplicates(
      supabase,
      valid.map((r) => ({ customerName: r.customerName, invoiceDate: r.invoiceDate, quotationRef: r.quotationRef }))
    );
    const duplicateRowNumbers = valid
      .filter((r) => duplicateKeys.has(historicalSalesService.fingerprint(r.customerName, r.invoiceDate, r.quotationRef)))
      .map((r) => r.rowNumber);

    return { ok: true, data: { valid, invalidCount, duplicateRowNumbers } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to validate the import.' };
  }
}

export async function commitHistoricalImportAction(rows: NormalizedHistoricalRow[]): Promise<ActionResult<{ imported: number }>> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  try {
    const result = await historicalSalesService.commitHistoricalImport(supabase, rows, user.id);
    revalidatePath('/sales');
    return { ok: true, data: result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to import historical sales.' };
  }
}
