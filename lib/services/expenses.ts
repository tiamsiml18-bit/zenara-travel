import type { SupabaseClient } from '@supabase/supabase-js';
import { unwrapToOne } from '@/lib/utils/unwrap-embed';
import type { ExpenseInput } from '@/lib/validation/expenses';

const EXPENSE_SELECT = `
  id, expense_date, description, amount, payment_status, payment_method, due_date, remarks, created_at,
  category:expense_categories ( id, name ),
  credit_card:credit_cards ( id, card_name, last_four ),
  client:clients ( id, full_name ),
  quotation:quotations ( id, quotation_number ),
  booking:bookings ( id, booking_number )
`;

export interface ExpenseFilters {
  search?: string;
  categoryId?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  creditCardId?: string;
  clientId?: string;
  quotationId?: string;
  bookingId?: string;
  dateFrom?: string;
  dateTo?: string;
}

function mapExpenseRow(r: Record<string, unknown>) {
  const category = unwrapToOne(r.category) as { id: string; name: string } | null;
  const creditCard = unwrapToOne(r.credit_card) as { id: string; card_name: string; last_four: string } | null;
  const client = unwrapToOne(r.client) as { id: string; full_name: string } | null;
  const quotation = unwrapToOne(r.quotation) as { id: string; quotation_number: string } | null;
  const booking = unwrapToOne(r.booking) as { id: string; booking_number: string } | null;
  return {
    id: r.id as string,
    expenseDate: r.expense_date as string,
    description: r.description as string,
    amount: Number(r.amount),
    paymentStatus: r.payment_status as string,
    paymentMethod: r.payment_method as string,
    dueDate: r.due_date as string | null,
    remarks: (r.remarks as string | null) ?? '',
    categoryId: category?.id ?? null,
    categoryName: category?.name ?? '—',
    creditCardId: creditCard?.id ?? null,
    creditCardLabel: creditCard ? `${creditCard.card_name} •••• ${creditCard.last_four}` : null,
    clientId: client?.id ?? null,
    clientName: client?.full_name ?? null,
    quotationId: quotation?.id ?? null,
    quotationNumber: quotation?.quotation_number ?? null,
    bookingId: booking?.id ?? null,
    bookingNumber: booking?.booking_number ?? null,
  };
}
export type ExpenseRow = ReturnType<typeof mapExpenseRow>;

export async function listExpenses(supabase: SupabaseClient, filters: ExpenseFilters = {}) {
  let query = supabase.from('expenses').select(EXPENSE_SELECT).order('expense_date', { ascending: false });

  if (filters.categoryId) query = query.eq('category_id', filters.categoryId);
  if (filters.paymentStatus) query = query.eq('payment_status', filters.paymentStatus);
  if (filters.paymentMethod) query = query.eq('payment_method', filters.paymentMethod);
  if (filters.creditCardId) query = query.eq('credit_card_id', filters.creditCardId);
  if (filters.clientId) query = query.eq('client_id', filters.clientId);
  if (filters.quotationId) query = query.eq('quotation_id', filters.quotationId);
  if (filters.bookingId) query = query.eq('booking_id', filters.bookingId);
  if (filters.dateFrom) query = query.gte('expense_date', filters.dateFrom);
  if (filters.dateTo) query = query.lte('expense_date', filters.dateTo);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load expenses: ${error.message}`);
  let rows = (data ?? []).map(mapExpenseRow);

  if (filters.search) {
    const q = filters.search.trim().toLowerCase();
    rows = rows.filter(
      (r) =>
        r.description.toLowerCase().includes(q) ||
        (r.clientName ?? '').toLowerCase().includes(q) ||
        (r.quotationNumber ?? '').toLowerCase().includes(q) ||
        (r.bookingNumber ?? '').toLowerCase().includes(q)
    );
  }

  return rows;
}

/** Every expense linked to a specific quotation — used by the "View Expenses" link on both the Sales row and the quotation detail page. */
export async function listExpensesForQuotation(supabase: SupabaseClient, quotationId: string) {
  return listExpenses(supabase, { quotationId });
}

/**
 * The actual sum used when a Sales record's Cost Source is set to
 * "Linked Expenses" — a lightweight, dedicated query (not the full
 * listExpenses shape) since this runs once per Sales row on the Sales
 * page. Matched by quotation_id, not booking_id: an expense links to the
 * quotation directly (per spec), and a booking maps to exactly one
 * quotation, so this correctly totals every expense tied to that
 * quotation regardless of whether the individual expense also happens to
 * carry its own booking_id.
 */
export async function getLinkedExpensesTotal(supabase: SupabaseClient, quotationId: string): Promise<number> {
  const { data, error } = await supabase.from('expenses').select('amount').eq('quotation_id', quotationId);
  if (error) throw new Error(`Failed to total linked expenses: ${error.message}`);
  return (data ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
}

/** One amount per quotation, for efficiently annotating a whole Sales table at once rather than one query per row. */
export async function getLinkedExpenseTotalsByQuotation(supabase: SupabaseClient, quotationIds: string[]): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  if (quotationIds.length === 0) return totals;
  const { data, error } = await supabase.from('expenses').select('quotation_id, amount').in('quotation_id', quotationIds);
  if (error) throw new Error(`Failed to total linked expenses: ${error.message}`);
  for (const r of data ?? []) {
    if (!r.quotation_id) continue;
    totals.set(r.quotation_id, (totals.get(r.quotation_id) ?? 0) + Number(r.amount));
  }
  return totals;
}

export async function upsertExpense(supabase: SupabaseClient, input: ExpenseInput, actingUserId: string) {
  const patch = {
    expense_date: input.expenseDate,
    description: input.description,
    category_id: input.categoryId || null,
    amount: input.amount,
    payment_status: input.paymentStatus,
    payment_method: input.paymentMethod,
    // A card only makes sense when the payment method is actually Credit
    // Card -- cleared otherwise so switching methods doesn't leave a
    // stale card reference behind.
    credit_card_id: input.paymentMethod === 'credit_card' ? input.creditCardId || null : null,
    due_date: input.dueDate || null,
    client_id: input.clientId || null,
    quotation_id: input.quotationId || null,
    booking_id: input.bookingId || null,
    remarks: input.remarks || null,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error } = await supabase.from('expenses').update(patch).eq('id', input.id);
    if (error) throw new Error(`Failed to update expense: ${error.message}`);
    return { id: input.id };
  }
  const { data, error } = await supabase.from('expenses').insert({ ...patch, created_by: actingUserId }).select('id').single();
  if (error || !data) throw new Error(`Failed to add expense: ${error?.message}`);
  return { id: data.id as string };
}

export async function deleteExpense(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete expense: ${error.message}`);
}

export async function listUpcomingExpenses(supabase: SupabaseClient) {
  const rows = await listExpenses(supabase);
  const today = new Date().toISOString().slice(0, 10);
  return rows
    .filter((r) => r.dueDate && r.paymentStatus !== 'paid')
    .map((r) => ({ ...r, daysRemaining: Math.round((new Date(r.dueDate as string).getTime() - new Date(today).getTime()) / 86400000) }))
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : a.dueDate! > b.dueDate! ? 1 : 0));
}

export function getExpensesSummary(rows: ExpenseRow[]) {
  const now = new Date();
  const thisMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return {
    totalExpenses: rows.reduce((sum, r) => sum + r.amount, 0),
    paidExpenses: rows.filter((r) => r.paymentStatus === 'paid').reduce((sum, r) => sum + r.amount, 0),
    pendingExpenses: rows.filter((r) => r.paymentStatus !== 'paid').reduce((sum, r) => sum + r.amount, 0),
    thisMonth: rows.filter((r) => r.expenseDate.startsWith(thisMonthPrefix)).reduce((sum, r) => sum + r.amount, 0),
    creditCardExpenses: rows.filter((r) => r.paymentMethod === 'credit_card').reduce((sum, r) => sum + r.amount, 0),
    linkedTripExpenses: rows.filter((r) => r.quotationId).reduce((sum, r) => sum + r.amount, 0),
  };
}

// ============================================================================
// Categories & Credit Cards — small, self-contained lookups.
// ============================================================================

/**
 * A small, Expenses-specific quotation search — separate from the main
 * quotations list/service so nothing about the existing Quotations page
 * or its queries is touched. Returns each quotation's own client and any
 * existing booking, so selecting a quotation can auto-fill Customer (and
 * offer the matching Booking) without a second lookup.
 */
export async function searchQuotationsForPicker(supabase: SupabaseClient, search: string) {
  if (!search || search.trim().length < 2) return [];
  const { data, error } = await supabase
    .from('quotations')
    .select('id, quotation_number, client:clients(id, full_name), booking:bookings(id, booking_number)')
    .is('deleted_at', null)
    .ilike('quotation_number', `%${search.trim()}%`)
    .limit(10);
  if (error) throw new Error(`Failed to search quotations: ${error.message}`);

  // A plain ilike on quotation_number misses "search by client name"
  // (e.g. "Anne Cherub") -- broaden with a second pass when the first
  // came up empty and the term doesn't look like a quotation number.
  let rows = data ?? [];
  if (rows.length === 0 && !/^QT-/i.test(search.trim())) {
    const { data: byClient, error: clientError } = await supabase
      .from('quotations')
      .select('id, quotation_number, client:clients!inner(id, full_name), booking:bookings(id, booking_number)')
      .is('deleted_at', null)
      .ilike('client.full_name', `%${search.trim()}%`)
      .limit(10);
    if (clientError) throw new Error(`Failed to search quotations: ${clientError.message}`);
    rows = byClient ?? [];
  }

  return rows.map((r) => {
    const client = unwrapToOne(r.client) as { id: string; full_name: string } | null;
    const booking = unwrapToOne(r.booking) as { id: string; booking_number: string } | null;
    return {
      quotationId: r.id as string,
      quotationNumber: r.quotation_number as string,
      clientId: client?.id ?? null,
      clientName: client?.full_name ?? null,
      bookingId: booking?.id ?? null,
      bookingNumber: booking?.booking_number ?? null,
    };
  });
}

export async function listExpenseCategories(supabase: SupabaseClient) {
  const { data, error } = await supabase.from('expense_categories').select('id, name').eq('is_active', true).order('sort_order');
  if (error) throw new Error(`Failed to load expense categories: ${error.message}`);
  return data ?? [];
}

export async function addExpenseCategory(supabase: SupabaseClient, name: string) {
  const { error } = await supabase.from('expense_categories').insert({ name, sort_order: 999 });
  if (error) throw new Error(`Failed to add category: ${error.message}`);
}

export async function listCreditCards(supabase: SupabaseClient, activeOnly = false) {
  let query = supabase.from('credit_cards').select('id, card_name, last_four, card_type, is_active').order('card_name');
  if (activeOnly) query = query.eq('is_active', true);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to load credit cards: ${error.message}`);
  return data ?? [];
}

export async function upsertCreditCard(
  supabase: SupabaseClient,
  input: { id?: string; cardName: string; lastFour: string; cardType?: string; isActive: boolean }
) {
  const patch = { card_name: input.cardName, last_four: input.lastFour, card_type: input.cardType || null, is_active: input.isActive };
  if (input.id) {
    const { error } = await supabase.from('credit_cards').update(patch).eq('id', input.id);
    if (error) throw new Error(`Failed to update card: ${error.message}`);
    return { id: input.id };
  }
  const { data, error } = await supabase.from('credit_cards').insert(patch).select('id').single();
  if (error || !data) throw new Error(`Failed to add card: ${error?.message}`);
  return { id: data.id as string };
}
