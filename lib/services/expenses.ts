import type { SupabaseClient } from '@supabase/supabase-js';
import { unwrapToOne } from '@/lib/utils/unwrap-embed';
import type { ExpenseInput, RecurringExpenseInput } from '@/lib/validation/expenses';

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

// ============================================================================
// Recurring Expenses — a schedule that lazily generates real expense rows,
// one occurrence per due period, never a batch of future rows up front.
// ============================================================================

/** The period key a given date falls into for a frequency — e.g. monthly '2026-09', quarterly '2026-Q3', yearly '2026'. Two dates in the same period always produce the same key, which is exactly what the database's unique (schedule, period) constraint relies on to prevent duplicates. */
export function periodKeyFor(date: Date, frequency: 'monthly' | 'quarterly' | 'yearly'): string {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth(); // 0-indexed
  if (frequency === 'yearly') return String(year);
  if (frequency === 'quarterly') return `${year}-Q${Math.floor(month / 3) + 1}`;
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

/** The first day of the period AFTER the one containing `date`, for a given frequency — used to step from one occurrence to the next. */
export function nextPeriodStart(date: Date, frequency: 'monthly' | 'quarterly' | 'yearly'): Date {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const monthsToAdd = frequency === 'yearly' ? 12 : frequency === 'quarterly' ? 3 : 1;
  next.setUTCMonth(next.getUTCMonth() + monthsToAdd);
  return next;
}

/**
 * Every due-but-not-yet-generated occurrence date for one schedule, up to
 * (and including) `asOf` — never beyond it, per spec ("do not create
 * hundreds of future expense records immediately"). Deliberately a pure
 * function of (startDate, endDate, frequency, asOf) with no side
 * effects, so the "which periods are due" logic is directly testable
 * without a database.
 */
export function computeDueOccurrenceDates(params: { startDate: string; endDate: string | null; frequency: 'monthly' | 'quarterly' | 'yearly'; asOf: Date }): Date[] {
  const dates: Date[] = [];
  let cursor = new Date(`${params.startDate}T00:00:00Z`);
  const end = params.endDate ? new Date(`${params.endDate}T00:00:00Z`) : null;
  // A hard cap, not a realistic limit — guards against an unexpected
  // infinite loop rather than reflecting any real recurring expense's
  // actual lifetime.
  let guard = 0;
  while (cursor.getTime() <= params.asOf.getTime() && guard < 2000) {
    if (end && cursor.getTime() > end.getTime()) break;
    dates.push(new Date(cursor));
    cursor = nextPeriodStart(cursor, params.frequency);
    guard += 1;
  }
  return dates;
}

export async function listRecurringSchedules(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('recurring_expense_schedules')
    .select(
      `id, description, amount, frequency, start_date, end_date, status, due_day_offset,
       category:expense_categories(id, name)`
    )
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Failed to load recurring expenses: ${error.message}`);

  const scheduleIds = (data ?? []).map((s) => s.id);
  const nextDueByScheduleId = await getNextDueDates(supabase, scheduleIds);

  return (data ?? []).map((s) => {
    const category = unwrapToOne(s.category) as { id: string; name: string } | null;
    return {
      id: s.id as string,
      description: s.description as string,
      categoryName: category?.name ?? '—',
      amount: Number(s.amount),
      frequency: s.frequency as 'monthly' | 'quarterly' | 'yearly',
      startDate: s.start_date as string,
      endDate: s.end_date as string | null,
      status: s.status as 'active' | 'paused' | 'ended',
      nextDueDate: nextDueByScheduleId.get(s.id as string) ?? null,
    };
  });
}

/** The next occurrence date each active schedule hasn't generated yet — for display only; actual generation happens in generateDueRecurringExpenses. */
async function getNextDueDates(supabase: SupabaseClient, scheduleIds: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (scheduleIds.length === 0) return result;
  const { data: schedules } = await supabase
    .from('recurring_expense_schedules')
    .select('id, frequency, start_date, end_date, status')
    .in('id', scheduleIds);
  const { data: existing } = await supabase.from('expenses').select('recurring_schedule_id, occurrence_period').in('recurring_schedule_id', scheduleIds);
  const generatedPeriods = new Map<string, Set<string>>();
  for (const e of existing ?? []) {
    if (!e.recurring_schedule_id || !e.occurrence_period) continue;
    if (!generatedPeriods.has(e.recurring_schedule_id)) generatedPeriods.set(e.recurring_schedule_id, new Set());
    generatedPeriods.get(e.recurring_schedule_id)!.add(e.occurrence_period);
  }

  const farFuture = new Date();
  farFuture.setUTCFullYear(farFuture.getUTCFullYear() + 5); // effectively "keep stepping until we find an ungenerated period"
  for (const s of schedules ?? []) {
    if (s.status !== 'active') continue;
    let cursor = new Date(`${s.start_date}T00:00:00Z`);
    const end = s.end_date ? new Date(`${s.end_date}T00:00:00Z`) : null;
    const generated = generatedPeriods.get(s.id) ?? new Set();
    let guard = 0;
    while (guard < 2000) {
      if (end && cursor.getTime() > end.getTime()) break;
      const key = periodKeyFor(cursor, s.frequency);
      if (!generated.has(key)) {
        result.set(s.id, cursor.toISOString().slice(0, 10));
        break;
      }
      cursor = nextPeriodStart(cursor, s.frequency);
      guard += 1;
    }
  }
  return result;
}

export async function upsertRecurringSchedule(supabase: SupabaseClient, input: RecurringExpenseInput, actingUserId: string) {
  // Derived once, from the agent's own Expense Date / Due Date pair, so
  // every future occurrence gets a consistent relative due date without
  // being re-asked for one each time.
  const dueDayOffset =
    input.dueDate && input.startDate
      ? Math.round((new Date(`${input.dueDate}T00:00:00Z`).getTime() - new Date(`${input.startDate}T00:00:00Z`).getTime()) / 86400000)
      : null;

  const patch = {
    description: input.description,
    category_id: input.categoryId || null,
    amount: input.amount,
    payment_status: input.paymentStatus,
    payment_method: input.paymentMethod,
    credit_card_id: input.paymentMethod === 'credit_card' ? input.creditCardId || null : null,
    due_day_offset: dueDayOffset,
    client_id: input.clientId || null,
    quotation_id: input.quotationId || null,
    booking_id: input.bookingId || null,
    remarks: input.remarks || null,
    frequency: input.frequency,
    start_date: input.startDate,
    end_date: input.endDate || null,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error } = await supabase.from('recurring_expense_schedules').update(patch).eq('id', input.id);
    if (error) throw new Error(`Failed to update recurring expense: ${error.message}`);
    return { id: input.id };
  }
  const { data, error } = await supabase.from('recurring_expense_schedules').insert({ ...patch, created_by: actingUserId }).select('id').single();
  if (error || !data) throw new Error(`Failed to add recurring expense: ${error?.message}`);

  // Generate immediately so the agent sees the first occurrence (e.g.
  // this month's Canva charge) right away, exactly as if they'd added it
  // as a normal expense -- the schedule itself is never counted as a
  // financial expense, only what this call actually inserts.
  await generateDueRecurringExpenses(supabase, [data.id as string]);
  return { id: data.id as string };
}

export async function updateRecurringStatus(supabase: SupabaseClient, id: string, status: 'active' | 'paused' | 'ended') {
  const { error } = await supabase.from('recurring_expense_schedules').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(`Failed to update recurring expense status: ${error.message}`);
}

/**
 * The actual generation step. For every active schedule (optionally
 * restricted to a specific set of ids), computes every due-but-ungenerated
 * period and inserts one expense row per period — using
 * ignoreDuplicates so the database's unique (schedule, period) index is
 * the real guarantee against ever generating the same occurrence twice,
 * even if this function is called concurrently or repeatedly. Safe to
 * call as often as needed (e.g. every time the Expenses page loads).
 */
export async function generateDueRecurringExpenses(supabase: SupabaseClient, scheduleIds?: string[]): Promise<{ generated: number }> {
  let query = supabase
    .from('recurring_expense_schedules')
    .select('id, description, category_id, amount, payment_status, payment_method, credit_card_id, due_day_offset, client_id, quotation_id, booking_id, remarks, frequency, start_date, end_date')
    .eq('status', 'active');
  if (scheduleIds && scheduleIds.length > 0) query = query.in('id', scheduleIds);
  const { data: schedules, error } = await query;
  if (error) throw new Error(`Failed to load recurring schedules: ${error.message}`);
  if (!schedules || schedules.length === 0) return { generated: 0 };

  const today = new Date();
  const rows: Record<string, unknown>[] = [];
  for (const s of schedules) {
    const dueDates = computeDueOccurrenceDates({
      startDate: s.start_date,
      endDate: s.end_date,
      frequency: s.frequency as 'monthly' | 'quarterly' | 'yearly',
      asOf: today,
    });
    for (const d of dueDates) {
      const expenseDate = d.toISOString().slice(0, 10);
      const dueDate = s.due_day_offset !== null ? new Date(d.getTime() + s.due_day_offset * 86400000).toISOString().slice(0, 10) : null;
      rows.push({
        expense_date: expenseDate,
        description: s.description,
        category_id: s.category_id,
        amount: s.amount,
        payment_status: s.payment_status,
        payment_method: s.payment_method,
        credit_card_id: s.credit_card_id,
        due_date: dueDate,
        client_id: s.client_id,
        quotation_id: s.quotation_id,
        booking_id: s.booking_id,
        remarks: s.remarks,
        recurring_schedule_id: s.id,
        occurrence_period: periodKeyFor(d, s.frequency as 'monthly' | 'quarterly' | 'yearly'),
      });
    }
  }
  if (rows.length === 0) return { generated: 0 };

  const { error: insertError, count } = await supabase
    .from('expenses')
    .upsert(rows, { onConflict: 'recurring_schedule_id,occurrence_period', ignoreDuplicates: true, count: 'exact' });
  if (insertError) throw new Error(`Failed to generate recurring expenses: ${insertError.message}`);
  return { generated: count ?? 0 };
}

