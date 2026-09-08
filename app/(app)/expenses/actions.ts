'use server';

import { revalidatePath } from 'next/cache';
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import * as expensesService from '@/lib/services/expenses';
import * as salesService from '@/lib/services/sales';
import { expenseSchema, type ExpenseInput, creditCardSchema, type CreditCardInput, costSourceUpdateSchema, type CostSourceUpdateInput } from '@/lib/validation/expenses';

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

export async function searchQuotationsForExpenseAction(search: string) {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  try {
    const results = await expensesService.searchQuotationsForPicker(supabase, search);
    return { ok: true as const, data: results };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : 'Search failed.' };
  }
}

export async function upsertExpenseAction(input: ExpenseInput): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid expense details.' };

  const supabase = await createSupabaseServerClient();
  try {
    const result = await expensesService.upsertExpense(supabase, parsed.data, user.id);
    revalidatePath('/expenses');
    revalidatePath('/sales');
    if (parsed.data.quotationId) revalidatePath(`/quotations/${parsed.data.quotationId}`);
    return { ok: true, data: result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to save expense.' };
  }
}

export async function deleteExpenseAction(id: string, quotationId?: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  try {
    // Total Cost for any Sales record on Linked Expenses recalculates
    // automatically the next time the Sales page is read, since it's
    // always derived live from the sum of an expense's own rows — there
    // is no separate cached total to go stale here.
    await expensesService.deleteExpense(supabase, id);
    revalidatePath('/expenses');
    revalidatePath('/sales');
    if (quotationId) revalidatePath(`/quotations/${quotationId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to delete expense.' };
  }
}

export async function upsertCreditCardAction(input: CreditCardInput): Promise<ActionResult<{ id: string }>> {
  await requireUser();
  const parsed = creditCardSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid card details.' };

  const supabase = await createSupabaseServerClient();
  try {
    const result = await expensesService.upsertCreditCard(supabase, parsed.data);
    revalidatePath('/expenses');
    return { ok: true, data: result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to save card.' };
  }
}

export async function addExpenseCategoryAction(name: string): Promise<ActionResult> {
  await requireUser();
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: 'Category name is required.' };
  const supabase = await createSupabaseServerClient();
  try {
    await expensesService.addExpenseCategory(supabase, trimmed);
    revalidatePath('/expenses');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to add category.' };
  }
}

/** Switches a Sales record between Manual and Linked Expenses cost sources — the one control point for avoiding double counting. */
export async function updateCostSourceAction(input: CostSourceUpdateInput): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = costSourceUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid cost source.' };

  const supabase = await createSupabaseServerClient();
  try {
    await salesService.updateCostSource(supabase, parsed.data.bookingId, parsed.data.costSource, user.id);
    revalidatePath('/sales');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to switch cost source.' };
  }
}
